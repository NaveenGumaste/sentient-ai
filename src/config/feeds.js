export const NEWS_FEEDS = {
  ai: {
    name: "AI News",
    color: 0x90ee90, // Light green
    feeds: [
      "https://www.artificialintelligence-news.com/feed/",
      "https://news.mit.edu/topic/mitartificial-intelligence2-rss.xml",
      "https://venturebeat.com/category/ai/feed/",
    ],
  },
  llm: {
    name: "LLM & ML News",
    color: 0x9b59b6, // Purple
    feeds: [
      "https://huggingface.co/blog/feed.xml",
      "https://openai.com/blog/rss.xml",
      "https://www.marktechpost.com/feed/",
    ],
  },
  tech: {
    name: "Tech News",
    color: 0xe74c3c, // Red
    feeds: [
      "https://hnrss.org/frontpage",
      "https://techcrunch.com/feed/",
      "https://www.theverge.com/rss/index.xml",
      "https://arstechnica.com/feed/",
    ],
  },
  opensource: {
    name: "Open Source News",
    color: 0xf1c40f, // Yellow
    feeds: [
      "https://opensource.com/feed",
      "https://www.opensourceforu.com/feed/",
      "https://github.blog/feed/",
    ],
  },
  moneycontrol: {
    name: "Moneycontrol Market Updates",
    color: 0xf39c12, // Orange
    articleLimit: 12,
    sourceType: "moneycontrol",
    // Keep direct Moneycontrol sections opt-in via MONEYCONTROL_SECTION_URLS env override,
    // since many regions/IPs get 403 for bot-like traffic.
    sectionUrls: [],
    allowedFeedHosts: [
      "news.google.com",
      "economictimes.indiatimes.com",
      "in.investing.com",
      "www.business-standard.com",
      "business-standard.com",
      "moneycontrol.com",
      "www.moneycontrol.com",
    ],
    feedKeywords: [
      "small cap",
      "smallcap",
      "bank",
      "banking",
      "finance",
      "oil",
      "gas",
      "energy",
      "commodit",
      "crude",
      "lpg",
      "nifty",
      "sensex",
      "stock market",
      "nse",
      "bse",
      "market",
    ],
    fallbackFeeds: [
      // Moneycontrol-related fallback via Google News (stable when direct Moneycontrol blocks).
      "https://news.google.com/rss/search?q=site:moneycontrol.com+small+cap+india&hl=en-IN&gl=IN&ceid=IN:en",
      "https://news.google.com/rss/search?q=site:moneycontrol.com+bank+stocks+india&hl=en-IN&gl=IN&ceid=IN:en",
      "https://news.google.com/rss/search?q=site:moneycontrol.com+oil+gas+india&hl=en-IN&gl=IN&ceid=IN:en",
      // Economic Times sector feeds.
      "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
      "https://economictimes.indiatimes.com/industry/banking/finance/rssfeeds/13358259.cms",
      "https://economictimes.indiatimes.com/industry/energy/rssfeeds/13358134.cms",
      // Investing India macro + commodities.
      "https://in.investing.com/rss/news.rss",
      // Business Standard backup feeds.
      "https://www.business-standard.com/rss/markets-106.rss",
      "https://www.business-standard.com/rss/industry/banking-21703.rss",
      "https://www.business-standard.com/rss/markets/commodities-10608.rss",
    ],
  },
};

export const FEED_FETCH_TIMEOUT = 15000; // 15 seconds
export const MAX_ARTICLES_PER_FETCH = 5; // Max articles per category per fetch
export const REDIS_KEY_PREFIX = "discord-news-bot:posted:";
export const REDIS_EXPIRY_DAYS = 7; // Keep posted article IDs for 7 days
