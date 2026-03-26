# Discord News Bot

A Discord bot that continuously checks RSS feeds and posts the latest news on AI, LLMs, Tech, and Open Source to your Discord channels as soon as it detects them. Uses Upstash Redis to prevent duplicate posts.

> This is the stable `main` branch. The experimental trading/Moneycontrol work lives on `dev`.

## Features

- 🤖 **AI News** - MIT AI News, VentureBeat AI, AI News
- 🧠 **LLM/ML News** - HuggingFace, OpenAI Blog, MarkTechPost
- 💻 **Tech News** - HackerNews, TechCrunch, The Verge, Ars Technica  
- 🌐 **Open Source** - OpenSource.com, GitHub Blog

## Setup

### 1. Create Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to "Bot" section and click "Add Bot"
4. Copy the **Bot Token**
5. Enable these under "Privileged Gateway Intents":
   - None required for this bot!
6. Go to "OAuth2" > "URL Generator"
   - Select scopes: `bot`
   - Select permissions: `Send Messages`, `Embed Links`
7. Copy the generated URL and invite the bot to your server

### 2. Setup Upstash Redis

1. Go to [Upstash Console](https://console.upstash.com/)
2. Create a new Redis database (free tier works great!)
3. Copy the **REST URL** and **REST Token**

### 3. Get Channel IDs

1. In Discord, enable Developer Mode (User Settings > App Settings > Advanced)
2. Right-click on your target channel(s) and click "Copy ID"

### 4. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```env
# Discord Bot Token
DISCORD_TOKEN=your_discord_bot_token_here

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here

# Channel IDs (use specific channels OR a single channel for all)
CHANNEL_AI=1234567890123456789
CHANNEL_LLM=1234567890123456789
CHANNEL_TECH=1234567890123456789
CHANNEL_OPENSOURCE=1234567890123456789

# OR use one channel for everything
CHANNEL_ALL=1234567890123456789

# Polling interval in milliseconds (default: 60 seconds)
# Lower values mean faster checks, but more feed requests
POLL_INTERVAL_MS=60000
```

### 5. Install & Run

```bash
# Install dependencies
npm install

# Run the bot
npm start

# Development mode (auto-restart on changes)
npm run dev
```

## Polling Behavior

The bot does not use cron or fixed posting times anymore. Instead, it runs a continuous loop that checks each feed on a short interval and posts any new item it finds immediately after the next poll.

If you want faster updates, lower `POLL_INTERVAL_MS` in `.env`. The default is 60 seconds.

## Customization

### Adding More RSS Feeds

Edit `src/config/feeds.js` to add or modify feed sources:

```javascript
export const NEWS_FEEDS = {
  ai: {
    name: 'AI News',
    emoji: '🤖',
    color: 0x7289da,
    feeds: [
      'https://your-new-feed-url.com/rss',
      // Add more feeds here
    ]
  },
  // Add new categories...
};
```

### Adjust Article Limits

In `src/config/feeds.js`:
- `MAX_ARTICLES_PER_FETCH`: How many articles per category per run
- `REDIS_EXPIRY_DAYS`: How long to remember posted articles

### Branch Notes

- `main`: stable core RSS bot for AI, LLM, Tech, and Open Source
- `dev`: trading/Moneycontrol branch with market-style embeds and extra feed fallbacks

## Deployment

### Using PM2 (Recommended)

```bash
npm install -g pm2
pm2 start src/index.js --name discord-news-bot
pm2 save
pm2 startup  # Enable auto-start on reboot
```

### Using Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["npm", "start"]
```

## License

MIT
