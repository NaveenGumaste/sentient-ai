import Parser from 'rss-parser';
import { NEWS_FEEDS, FEED_FETCH_TIMEOUT, MAX_ARTICLES_PER_FETCH } from '../config/feeds.js';

const parser = new Parser({
  timeout: FEED_FETCH_TIMEOUT,
  headers: {
    'User-Agent': 'Discord-News-Bot/1.0'
  },
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: true }],
      ['enclosure', 'enclosure'],
      ['content:encoded', 'contentEncoded'],
    ]
  }
});

async function fetchFeed(url) {
  try {
    const feed = await parser.parseURL(url);
    return feed.items || [];
  } catch (error) {
    console.error(`Failed to fetch feed ${url}:`, error.message);
    return [];
  }
}

export async function fetchNewsByCategory(category) {
  const config = NEWS_FEEDS[category];
  if (!config) {
    console.error(`Unknown category: ${category}`);
    return [];
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
    .map(article => {
      const image = extractImage(article);
      if (!image) return null; // Skip articles without images
      
      return {
        title: article.title?.trim() || 'No Title',
        link: article.link || article.guid || '',
        description: cleanDescription(article.contentSnippet || article.content || article.description || ''),
        pubDate: article.pubDate || article.isoDate || new Date().toISOString(),
        source: article.creator || extractDomain(article.link),
        image,
        author: article.creator || article.author || null,
        category
      };
    })
    .filter(article => article !== null); // Remove null entries

  // Return only articles with images
  return articlesWithImages.slice(0, MAX_ARTICLES_PER_FETCH);
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
    else if (typeof media === 'string') imageUrl = media;
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
    else if (typeof thumb === 'string') imageUrl = thumb;
  }
  
  // Try enclosure (common for podcasts/images)
  if (!imageUrl && article.enclosure?.url) {
    const type = article.enclosure.type || '';
    if (type.startsWith('image/')) imageUrl = article.enclosure.url;
  }
  
  // Try to extract from content HTML - get the first large-looking image
  if (!imageUrl) {
    const content = article.contentEncoded || article.content || article.description || '';
    // Look for img tags, prefer ones without small dimensions
    const imgMatches = content.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi);
    for (const match of imgMatches) {
      const imgTag = match[0];
      const src = match[1];
      // Skip small images (icons, avatars, etc.)
      if (imgTag.includes('width="1"') || imgTag.includes('height="1"')) continue;
      if (imgTag.includes('avatar') || imgTag.includes('icon') || imgTag.includes('logo')) continue;
      if (src.includes('gravatar') || src.includes('avatar') || src.includes('icon')) continue;
      if (src.includes('tracking') || src.includes('pixel') || src.includes('badge')) continue;
      imageUrl = src;
      break;
    }
  }
  
  // Try direct image URL in content
  if (!imageUrl) {
    const content = article.contentEncoded || article.content || article.description || '';
    const ogMatch = content.match(/https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>]*)?/i);
    if (ogMatch) {
      const url = ogMatch[0];
      // Skip small/tracking images
      if (!url.includes('avatar') && !url.includes('icon') && !url.includes('logo') && 
          !url.includes('tracking') && !url.includes('pixel') && !url.includes('badge')) {
        imageUrl = url;
      }
    }
  }
  
  // Validate the URL
  if (imageUrl) {
    // Must be a proper http(s) URL
    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      return null;
    }
    // Skip data URLs
    if (imageUrl.startsWith('data:')) {
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
  const cleaned = text
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > 300 ? cleaned.slice(0, 297) + '...' : cleaned;
}

function extractDomain(url) {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    return domain;
  } catch {
    return 'Unknown';
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
