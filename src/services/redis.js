import { Redis } from '@upstash/redis';
import { REDIS_KEY_PREFIX, REDIS_EXPIRY_DAYS } from '../config/feeds.js';

class RedisService {
  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }

  generateArticleId(article) {
    // Create a unique ID from the article URL or title
    const identifier = article.link || article.guid || article.title;
    return Buffer.from(identifier).toString('base64').slice(0, 64);
  }

  async isArticlePosted(article) {
    const articleId = this.generateArticleId(article);
    const key = `${REDIS_KEY_PREFIX}${articleId}`;
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  async markArticleAsPosted(article) {
    const articleId = this.generateArticleId(article);
    const key = `${REDIS_KEY_PREFIX}${articleId}`;
    const expirySeconds = REDIS_EXPIRY_DAYS * 24 * 60 * 60;
    await this.redis.setex(key, expirySeconds, Date.now().toString());
  }

  async filterNewArticles(articles) {
    const newArticles = [];
    for (const article of articles) {
      const isPosted = await this.isArticlePosted(article);
      if (!isPosted) {
        newArticles.push(article);
      }
    }
    return newArticles;
  }
}

export const redisService = new RedisService();
