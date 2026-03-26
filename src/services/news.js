import Parser from "rss-parser";
import {
  NEWS_FEEDS,
  FEED_FETCH_TIMEOUT,
  MAX_ARTICLES_PER_FETCH,
} from "../config/feeds.js";

const parser = new Parser({
  timeout: FEED_FETCH_TIMEOUT,
  headers: {
    "User-Agent": "Discord-News-Bot/1.0",
  },
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail", { keepArray: true }],
      ["enclosure", "enclosure"],
      ["content:encoded", "contentEncoded"],
    ],
  },
});

const REQUEST_HEADERS = {
  "User-Agent": "Discord-News-Bot/1.0",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

const SOURCE_BLOCK_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const blockedSourceUrls = new Map();

async function fetchFeed(url) {
  if (shouldSkipBlockedSource(url)) {
    return [];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FEED_FETCH_TIMEOUT);

  try {
    const response = await fetch(url, {
      headers: REQUEST_HEADERS,
      signal: controller.signal,
      redirect: "follow",
    });

    if (!response.ok) {
      if (isBlockableSourceStatus(response.status)) {
        markSourceBlocked(url, response.status);
        return [];
      }

      throw new Error(`HTTP ${response.status}`);
    }

    const xml = await response.text();
    const feed = await parser.parseString(xml);
    return feed.items || [];
  } catch (error) {
    console.error(`Failed to fetch feed ${url}:`, error.message);

    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchHtml(url) {
  if (shouldSkipBlockedSource(url)) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FEED_FETCH_TIMEOUT);

  try {
    const response = await fetch(url, {
      headers: REQUEST_HEADERS,
      signal: controller.signal,
      redirect: "follow",
    });

    if (!response.ok) {
      if (isBlockableSourceStatus(response.status)) {
        markSourceBlocked(url, response.status);
        return null;
      }

      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } catch (error) {
    console.error(`Failed to fetch HTML ${url}:`, error.message);

    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function shouldSkipBlockedSource(url) {
  if (!url || typeof url !== "string") {
    return false;
  }

  const blockedUntil = blockedSourceUrls.get(url);
  if (!blockedUntil) {
    return false;
  }

  if (blockedUntil <= Date.now()) {
    blockedSourceUrls.delete(url);
    return false;
  }

  return true;
}

function markSourceBlocked(url, status) {
  const now = Date.now();
  const blockedUntil = now + SOURCE_BLOCK_COOLDOWN_MS;
  const existing = blockedSourceUrls.get(url);

  if (!existing || existing <= now) {
    console.log(
      `⚠️ Source returned HTTP ${status} for ${url}. Pausing requests to this URL for 6 hours.`,
    );
  }

  blockedSourceUrls.set(url, blockedUntil);
}

function isBlockableSourceStatus(status) {
  return status === 403 || status === 404 || status === 410 || status === 451;
}

export async function fetchNewsByCategory(category) {
  const config = NEWS_FEEDS[category];
  if (!config) {
    console.error(`Unknown category: ${category}`);
    return [];
  }

  const articleLimit = getArticleLimit(config, category);

  if (config.sourceType === "moneycontrol") {
    return fetchMoneycontrolNews(config, category, articleLimit);
  }

  const allArticles = [];

  for (const feedUrl of config.feeds) {
    const articles = await fetchFeed(feedUrl);
    allArticles.push(...articles);
  }

  // Sort by publication date (newest first)
  allArticles.sort((a, b) => {
    const dateA = new Date(a.pubDate || a.isoDate || 0);
    const dateB = new Date(b.pubDate || b.isoDate || 0);
    return dateB - dateA;
  });

  // Map and filter - only include articles WITH images
  const articlesWithImages = allArticles
    .map((article) => {
      const image = extractImage(article);
      if (!image) return null; // Skip articles without images

      return {
        title: article.title?.trim() || "No Title",
        link: article.link || article.guid || "",
        description: cleanDescription(
          article.contentSnippet ||
            article.content ||
            article.description ||
            "",
        ),
        pubDate: article.pubDate || article.isoDate || new Date().toISOString(),
        source: article.creator || extractDomain(article.link),
        image,
        author: article.creator || article.author || null,
        category,
      };
    })
    .filter((article) => article !== null); // Remove null entries

  // Return only articles with images
  return articlesWithImages.slice(0, articleLimit);
}

async function fetchMoneycontrolNews(config, category, articleLimit) {
  const urls = resolveMoneycontrolSectionUrls(config);
  const candidatesByLink = new Map();

  for (const sectionUrl of urls) {
    const html = await fetchHtml(sectionUrl);
    if (!html) continue;

    const extracted = [
      ...extractArticlesFromJsonLd(html, sectionUrl),
      ...extractArticleLinks(html, sectionUrl),
    ];

    for (const article of extracted) {
      const normalizedLink = normalizeUrl(article.link, sectionUrl);
      if (!normalizedLink || !isMoneycontrolNewsLink(normalizedLink)) continue;

      if (!candidatesByLink.has(normalizedLink)) {
        candidatesByLink.set(normalizedLink, {
          title: article.title || "Moneycontrol Update",
          link: normalizedLink,
          description: article.description || "",
          pubDate: article.pubDate || null,
          image: article.image || null,
        });
      }
    }
  }

  if (
    candidatesByLink.size < articleLimit &&
    Array.isArray(config.fallbackFeeds)
  ) {
    const rssCandidates = await fetchMoneycontrolRssCandidates(config);
    for (const candidate of rssCandidates) {
      const normalizedLink = normalizeUrl(candidate.link, candidate.link);
      if (
        !normalizedLink ||
        !isTradingFeedItem({
          link: normalizedLink,
          title: candidate.title,
          description: candidate.description,
          config,
        })
      )
        continue;

      if (!candidatesByLink.has(normalizedLink)) {
        candidatesByLink.set(normalizedLink, {
          title: candidate.title || "Moneycontrol Update",
          link: normalizedLink,
          description: candidate.description || "",
          pubDate: candidate.pubDate || null,
          image: candidate.image || null,
          previousPrice: candidate.previousPrice ?? null,
          currentPrice: candidate.currentPrice ?? null,
          predictedPrice: candidate.predictedPrice ?? null,
        });
      }
    }
  }

  if (candidatesByLink.size === 0) {
    console.error(
      "Moneycontrol fetch returned no candidates (section pages and fallback feeds).",
    );
    return [];
  }

  const candidates = Array.from(candidatesByLink.values()).slice(
    0,
    articleLimit * 3,
  );
  const enriched = [];

  for (const candidate of candidates) {
    const detail = isMoneycontrolHost(candidate.link)
      ? await fetchMoneycontrolArticleDetails(candidate.link)
      : await fetchGenericArticleDetails(candidate.link);
    const subtitle =
      detail?.subtitle || candidate.description || "Moneycontrol market update";

    const extractedFromText = extractPriceData(
      `${candidate.title || ""} ${subtitle || ""}`,
    );

    const priceData = {
      previousPrice:
        detail?.previousPrice ??
        candidate.previousPrice ??
        extractedFromText.previousPrice ??
        null,
      currentPrice:
        detail?.currentPrice ??
        candidate.currentPrice ??
        extractedFromText.currentPrice ??
        null,
      predictedPrice:
        detail?.predictedPrice ??
        candidate.predictedPrice ??
        extractedFromText.predictedPrice ??
        null,
    };

    if (
      priceData.predictedPrice == null &&
      priceData.currentPrice != null &&
      priceData.previousPrice != null
    ) {
      const momentum = priceData.currentPrice - priceData.previousPrice;
      priceData.predictedPrice = roundPrice(priceData.currentPrice + momentum);
    }

    priceData.trendStatus = computeTrendStatus(
      priceData.currentPrice,
      priceData.predictedPrice,
    );

    enriched.push({
      title: detail?.title || candidate.title,
      link: candidate.link,
      description: subtitle,
      subtitle,
      pubDate: detail?.pubDate || candidate.pubDate || new Date().toISOString(),
      source: extractDomain(candidate.link),
      image: detail?.image || candidate.image || null,
      author: null,
      category,
      previousPrice: priceData.previousPrice,
      currentPrice: priceData.currentPrice,
      predictedPrice: priceData.predictedPrice,
      trendStatus: priceData.trendStatus,
    });

    await sleep(250);
  }

  enriched.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));
  return enriched.slice(0, articleLimit);
}

async function fetchGenericArticleDetails(articleUrl) {
  const html = await fetchHtml(articleUrl);
  if (!html) return null;

  const title =
    extractMetaContent(html, "property", "og:title") ||
    extractMetaContent(html, "name", "twitter:title") ||
    null;

  const subtitle = cleanDescription(
    extractMetaContent(html, "property", "og:description") ||
      extractMetaContent(html, "name", "description") ||
      extractMetaContent(html, "name", "twitter:description") ||
      "",
  );

  const image =
    extractMetaContent(html, "property", "og:image") ||
    extractMetaContent(html, "name", "twitter:image") ||
    null;

  const pubDate =
    extractMetaContent(html, "property", "article:published_time") || null;

  return {
    title,
    subtitle,
    image,
    pubDate,
    previousPrice: null,
    currentPrice: null,
    predictedPrice: null,
  };
}

async function fetchMoneycontrolRssCandidates(config) {
  const feedUrls = config.fallbackFeeds || [];
  const allItems = [];

  for (const feedUrl of feedUrls) {
    const items = await fetchFeed(feedUrl);

    for (const item of items) {
      const title = item.title?.trim() || "Moneycontrol Update";
      const description = cleanDescription(
        item.contentSnippet || item.content || item.description || "",
      );
      const link = normalizeUrl(item.link || item.guid || "", feedUrl);
      if (
        !link ||
        !isTradingFeedItem({
          link,
          title,
          description,
          feedUrl,
          config,
        })
      ) {
        continue;
      }

      const prices = extractPriceData(`${title} ${description}`);

      allItems.push({
        title,
        link,
        description,
        pubDate: item.pubDate || item.isoDate || null,
        image: extractImage(item),
        previousPrice: prices.previousPrice,
        currentPrice: prices.currentPrice,
        predictedPrice: prices.predictedPrice,
      });
    }
  }

  allItems.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));
  return allItems;
}

async function fetchMoneycontrolArticleDetails(articleUrl) {
  const html = await fetchHtml(articleUrl);
  if (!html) return null;

  const jsonLdArticles = extractArticlesFromJsonLd(html, articleUrl);
  const jsonLd =
    jsonLdArticles.find(
      (item) => normalizeUrl(item.link, articleUrl) === articleUrl,
    ) || jsonLdArticles[0];

  const title =
    extractMetaContent(html, "property", "og:title") ||
    extractMetaContent(html, "name", "twitter:title") ||
    jsonLd?.title ||
    "Moneycontrol Update";

  const subtitle =
    cleanDescription(
      extractMetaContent(html, "property", "og:description") ||
        extractMetaContent(html, "name", "description") ||
        extractMetaContent(html, "name", "twitter:description") ||
        jsonLd?.description ||
        extractArticleParagraphPreview(html),
    ) || "Moneycontrol market update";

  const image =
    extractMetaContent(html, "property", "og:image") ||
    extractMetaContent(html, "name", "twitter:image") ||
    jsonLd?.image ||
    null;

  const pubDate =
    extractMetaContent(html, "property", "article:published_time") ||
    extractMetaContent(html, "itemprop", "datePublished") ||
    jsonLd?.pubDate ||
    null;

  const combinedText = `${title} ${subtitle} ${extractArticleParagraphPreview(html, 8)}`;
  const prices = extractPriceData(combinedText);

  return {
    title,
    subtitle,
    image,
    pubDate,
    previousPrice: prices.previousPrice,
    currentPrice: prices.currentPrice,
    predictedPrice: prices.predictedPrice,
  };
}

function resolveMoneycontrolSectionUrls(config) {
  const fromEnv = process.env.MONEYCONTROL_SECTION_URLS?.split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  if (fromEnv?.length) {
    return fromEnv;
  }

  return config.sectionUrls || [];
}

function getArticleLimit(config, category) {
  if (category === "moneycontrol") {
    const envOverride = Number(process.env.MONEYCONTROL_MAX_ARTICLES_PER_FETCH);
    if (Number.isFinite(envOverride) && envOverride >= 1 && envOverride <= 50) {
      return Math.floor(envOverride);
    }
  }

  const configured = Number(config?.articleLimit);
  if (Number.isFinite(configured) && configured >= 1 && configured <= 50) {
    return Math.floor(configured);
  }

  return MAX_ARTICLES_PER_FETCH;
}

function extractArticlesFromJsonLd(html, baseUrl) {
  const scripts = extractJsonLdScripts(html);
  const articles = [];

  for (const script of scripts) {
    const nodes = flattenJsonLd(script);

    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;

      const type = normalizeJsonLdType(node["@type"]);
      const isArticle =
        type.includes("article") || type.includes("newsarticle");

      if (!isArticle && !node.headline && !node.url) continue;

      const link = normalizeUrl(resolveJsonLdUrl(node), baseUrl);
      if (!link) continue;

      articles.push({
        title: cleanDescription(node.headline || node.name || ""),
        link,
        description: cleanDescription(
          node.description || node.articleBody || "",
        ),
        pubDate: node.datePublished || node.dateModified || null,
        image: resolveJsonLdImage(node),
      });
    }
  }

  return articles;
}

function extractArticleLinks(html, baseUrl) {
  const links = [];
  const anchorRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorRegex.exec(html)) !== null) {
    const link = normalizeUrl(match[1], baseUrl);
    if (!link || !isMoneycontrolNewsLink(link)) continue;

    const text = cleanDescription(stripHtml(match[2]));
    if (!text || text.length < 25) continue;

    links.push({
      title: text,
      link,
      description: "",
      pubDate: null,
      image: null,
    });
  }

  return links;
}

function extractJsonLdScripts(html) {
  const scripts = [];
  const scriptRegex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptRegex.exec(html)) !== null) {
    const raw = match[1]
      .replace(/^\s*<!--/, "")
      .replace(/-->\s*$/, "")
      .trim();

    if (!raw) continue;

    try {
      scripts.push(JSON.parse(raw));
    } catch {
      // Ignore malformed JSON-LD blobs.
    }
  }

  return scripts;
}

function flattenJsonLd(node, result = []) {
  if (!node) return result;

  if (Array.isArray(node)) {
    node.forEach((item) => flattenJsonLd(item, result));
    return result;
  }

  if (typeof node !== "object") {
    return result;
  }

  result.push(node);

  if (Array.isArray(node["@graph"])) {
    flattenJsonLd(node["@graph"], result);
  }

  if (Array.isArray(node.itemListElement)) {
    node.itemListElement.forEach((item) => {
      if (item?.item) flattenJsonLd(item.item, result);
      else flattenJsonLd(item, result);
    });
  }

  return result;
}

function normalizeJsonLdType(type) {
  if (Array.isArray(type)) {
    return type.map((value) => String(value).toLowerCase());
  }

  if (!type) return [];
  return [String(type).toLowerCase()];
}

function resolveJsonLdUrl(node) {
  if (typeof node.url === "string") return node.url;

  if (node.mainEntityOfPage) {
    if (typeof node.mainEntityOfPage === "string") return node.mainEntityOfPage;
    if (typeof node.mainEntityOfPage === "object") {
      return node.mainEntityOfPage["@id"] || node.mainEntityOfPage.url || null;
    }
  }

  return null;
}

function resolveJsonLdImage(node) {
  const image = node.image;
  if (!image) return null;

  if (typeof image === "string") return image;

  if (Array.isArray(image)) {
    const first = image[0];
    if (typeof first === "string") return first;
    if (first?.url) return first.url;
    return null;
  }

  if (typeof image === "object" && image.url) return image.url;
  return null;
}

function extractMetaContent(html, attributeName, attributeValue) {
  const escaped = escapeRegExp(attributeValue);
  const patternA = new RegExp(
    `<meta[^>]*${attributeName}=["']${escaped}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    "i",
  );
  const patternB = new RegExp(
    `<meta[^>]*content=["']([^"']+)["'][^>]*${attributeName}=["']${escaped}["'][^>]*>`,
    "i",
  );

  return patternA.exec(html)?.[1] || patternB.exec(html)?.[1] || null;
}

function extractArticleParagraphPreview(html, maxParagraphs = 3) {
  const paragraphs = [];
  const regex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    const cleaned = cleanDescription(stripHtml(match[1]));
    if (!cleaned || cleaned.length < 30) continue;

    paragraphs.push(cleaned);
    if (paragraphs.length >= maxParagraphs) break;
  }

  return paragraphs.join(" ");
}

function extractPriceData(text) {
  if (!text) {
    return { previousPrice: null, currentPrice: null, predictedPrice: null };
  }

  const previousPrice = extractPriceByPatterns(text, [
    /(?:previous(?:\s+day)?(?:\s+close)?|prev(?:ious)?\s*close)\D{0,20}(\d[\d,]*\.?\d*)/i,
    /(?:yesterday(?:'s)?\s+close)\D{0,20}(\d[\d,]*\.?\d*)/i,
  ]);

  const currentPrice = extractPriceByPatterns(text, [
    /(?:current(?:\s+day)?(?:\s+price)?|current\s+market\s+price|cmp|ltp)\D{0,20}(\d[\d,]*\.?\d*)/i,
    /(?:trading\s+at|at\s+rs\.?|at\s+₹)\D{0,10}(\d[\d,]*\.?\d*)/i,
  ]);

  let predictedPrice = extractPriceByPatterns(text, [
    /(?:target(?:\s+price)?|predicted(?:\s+price)?|forecast(?:\s+price)?|next\s*day(?:\s+predicted)?\s*price)\D{0,20}(\d[\d,]*\.?\d*)/i,
  ]);

  const fallbackNumbers = hasQuoteLikePriceContext(text)
    ? extractCandidateNumbers(text)
    : [];

  const resolvedPrevious = previousPrice ?? fallbackNumbers[0] ?? null;
  const resolvedCurrent =
    currentPrice ?? fallbackNumbers[1] ?? fallbackNumbers[0] ?? null;

  if (
    predictedPrice == null &&
    resolvedCurrent != null &&
    resolvedPrevious != null
  ) {
    predictedPrice = roundPrice(
      resolvedCurrent + (resolvedCurrent - resolvedPrevious),
    );
  }

  return {
    previousPrice: resolvedPrevious,
    currentPrice: resolvedCurrent,
    predictedPrice,
  };
}

function hasQuoteLikePriceContext(text) {
  return /(cmp|target\s*price|previous\s*close|prev\s*close|current\s*price|trading\s+at|stock|share|nse|bse)/i.test(
    text,
  );
}

function extractPriceByPatterns(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;

    const parsed = parsePrice(match[1]);
    if (parsed != null) return parsed;
  }

  return null;
}

function extractCandidateNumbers(text) {
  const numbers = [];
  const regex =
    /(?:₹|rs\.?|inr)\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d+)?|\d+(?:\.\d+)?)/gi;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const parsed = parsePrice(match[1]);
    if (parsed == null) continue;

    // Avoid years and other obvious non-price numbers.
    if (Number.isInteger(parsed) && parsed >= 1900 && parsed <= 2100) continue;

    numbers.push(parsed);
    if (numbers.length >= 3) break;
  }

  return numbers;
}

function parsePrice(value) {
  if (value == null) return null;

  const parsed = Number(String(value).replace(/,/g, "").trim());
  if (!Number.isFinite(parsed)) return null;
  return roundPrice(parsed);
}

function roundPrice(value) {
  return Math.round(value * 100) / 100;
}

function computeTrendStatus(currentPrice, predictedPrice) {
  if (currentPrice == null || predictedPrice == null) return "same";

  if (predictedPrice > currentPrice) return "profit";
  if (predictedPrice < currentPrice) return "loss";
  return "same";
}

function normalizeUrl(url, baseUrl) {
  if (!url || typeof url !== "string") return null;

  try {
    const normalized = new URL(url, baseUrl);
    normalized.hash = "";
    return normalized.toString();
  } catch {
    return null;
  }
}

function isMoneycontrolNewsLink(url) {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.includes("moneycontrol.com") &&
      parsed.pathname.includes("/news/")
    );
  } catch {
    return false;
  }
}

function isMoneycontrolHost(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes("moneycontrol.com");
  } catch {
    return false;
  }
}

function isMoneycontrolFeedItem(link, title, description) {
  return isTradingFeedItem({ link, title, description });
}

function isTradingFeedItem({
  link,
  title,
  description,
  feedUrl = null,
  config = null,
}) {
  const allowedHosts = new Set(
    (config?.allowedFeedHosts || []).map((host) => host.toLowerCase()),
  );
  const linkHost = getHost(link);
  const feedHost = getHost(feedUrl);

  if (allowedHosts.size > 0) {
    const allowedByHost =
      (linkHost && allowedHosts.has(linkHost)) ||
      (feedHost && allowedHosts.has(feedHost));

    if (!allowedByHost) {
      return false;
    }
  }

  const keywords = (config?.feedKeywords || []).filter(Boolean);
  if (keywords.length === 0) {
    return true;
  }

  const text = `${title || ""} ${description || ""}`.toLowerCase();
  return keywords.some((keyword) =>
    text.includes(String(keyword).toLowerCase()),
  );
}

function getHost(url) {
  if (!url || typeof url !== "string") return null;

  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function stripHtml(text) {
  return String(text || "").replace(/<[^>]*>/g, " ");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractImage(article) {
  let imageUrl = null;

  // Try media:content (prefer larger images)
  if (article.mediaContent?.length) {
    // Sort by width if available, take largest
    const sorted = [...article.mediaContent].sort((a, b) => {
      const widthA = parseInt(a.$?.width) || 0;
      const widthB = parseInt(b.$?.width) || 0;
      return widthB - widthA;
    });
    const media = sorted[0];
    if (media.$ && media.$.url) imageUrl = media.$.url;
    else if (typeof media === "string") imageUrl = media;
  }

  // Try media:thumbnail
  if (!imageUrl && article.mediaThumbnail?.length) {
    const sorted = [...article.mediaThumbnail].sort((a, b) => {
      const widthA = parseInt(a.$?.width) || 0;
      const widthB = parseInt(b.$?.width) || 0;
      return widthB - widthA;
    });
    const thumb = sorted[0];
    if (thumb.$ && thumb.$.url) imageUrl = thumb.$.url;
    else if (typeof thumb === "string") imageUrl = thumb;
  }

  // Try enclosure (common for podcasts/images)
  if (!imageUrl && article.enclosure?.url) {
    const type = article.enclosure.type || "";
    if (type.startsWith("image/")) imageUrl = article.enclosure.url;
  }

  // Try to extract from content HTML - get the first large-looking image
  if (!imageUrl) {
    const content =
      article.contentEncoded || article.content || article.description || "";
    // Look for img tags, prefer ones without small dimensions
    const imgMatches = content.matchAll(
      /<img[^>]+src=["']([^"']+)["'][^>]*>/gi,
    );
    for (const match of imgMatches) {
      const imgTag = match[0];
      const src = match[1];
      // Skip small images (icons, avatars, etc.)
      if (imgTag.includes('width="1"') || imgTag.includes('height="1"'))
        continue;
      if (
        imgTag.includes("avatar") ||
        imgTag.includes("icon") ||
        imgTag.includes("logo")
      )
        continue;
      if (
        src.includes("gravatar") ||
        src.includes("avatar") ||
        src.includes("icon")
      )
        continue;
      if (
        src.includes("tracking") ||
        src.includes("pixel") ||
        src.includes("badge")
      )
        continue;
      imageUrl = src;
      break;
    }
  }

  // Try direct image URL in content
  if (!imageUrl) {
    const content =
      article.contentEncoded || article.content || article.description || "";
    const ogMatch = content.match(
      /https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>]*)?/i,
    );
    if (ogMatch) {
      const url = ogMatch[0];
      // Skip small/tracking images
      if (
        !url.includes("avatar") &&
        !url.includes("icon") &&
        !url.includes("logo") &&
        !url.includes("tracking") &&
        !url.includes("pixel") &&
        !url.includes("badge")
      ) {
        imageUrl = url;
      }
    }
  }

  // Validate the URL
  if (imageUrl) {
    // Must be a proper http(s) URL
    if (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://")) {
      return null;
    }
    // Skip data URLs
    if (imageUrl.startsWith("data:")) {
      return null;
    }
    // Skip very short URLs (likely broken)
    if (imageUrl.length < 20) {
      return null;
    }
  }

  return imageUrl;
}

function cleanDescription(text) {
  // Remove HTML tags and limit length
  const cleaned = String(text || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 300 ? cleaned.slice(0, 297) + "..." : cleaned;
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractDomain(url) {
  try {
    const domain = new URL(url).hostname.replace("www.", "");
    return domain;
  } catch {
    return "Unknown";
  }
}

export async function fetchAllNews() {
  const categories = Object.keys(NEWS_FEEDS);
  const results = {};

  for (const category of categories) {
    results[category] = await fetchNewsByCategory(category);
    console.log(`Fetched ${results[category].length} articles for ${category}`);
  }

  return results;
}
