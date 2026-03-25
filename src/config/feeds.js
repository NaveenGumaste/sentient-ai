export const NEWS_FEEDS = {
  ai: {
    name: 'AI News',
    color: 0x90EE90, // Light green
    feeds: [
      'https://www.artificialintelligence-news.com/feed/',
      'https://news.mit.edu/topic/mitartificial-intelligence2-rss.xml',
      'https://venturebeat.com/category/ai/feed/',
    ]
  },
  llm: {
    name: 'LLM & ML News',
    color: 0x9b59b6, // Purple
    feeds: [
      'https://huggingface.co/blog/feed.xml',
      'https://openai.com/blog/rss.xml',
      'https://www.marktechpost.com/feed/',
    ]
  },
  tech: {
    name: 'Tech News',
    color: 0xe74c3c, // Red
    feeds: [
      'https://hnrss.org/frontpage',
      'https://techcrunch.com/feed/',
      'https://www.theverge.com/rss/index.xml',
      'https://arstechnica.com/feed/',
    ]
  },
  opensource: {
    name: 'Open Source News',
    color: 0xf1c40f, // Yellow
    feeds: [
      'https://opensource.com/feed',
      'https://www.opensourceforu.com/feed/',
      'https://github.blog/feed/',
    ]
  }
};

export const FEED_FETCH_TIMEOUT = 15000; // 15 seconds
export const MAX_ARTICLES_PER_FETCH = 5; // Max articles per category per fetch
export const REDIS_KEY_PREFIX = 'discord-news-bot:posted:';
export const REDIS_EXPIRY_DAYS = 7; // Keep posted article IDs for 7 days
