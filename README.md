# Discord News Bot

A Discord bot that continuously checks RSS feeds and trading/news sources and posts the latest updates on AI, LLMs, Tech, Open Source, and Indian market news to your Discord channels as soon as it detects them. Uses Upstash Redis to prevent duplicate posts.

## Features

- 🤖 **AI News** - MIT AI News, VentureBeat AI, AI News
- 🧠 **LLM/ML News** - HuggingFace, OpenAI Blog, MarkTechPost
- 💻 **Tech News** - HackerNews, TechCrunch, The Verge, Ars Technica
- 🌐 **Open Source** - OpenSource.com, GitHub Blog
- 📈 **Moneycontrol Market Updates** - section-page scraping for Small Cap, Bank, and Oil & Gas topics

> This branch (`dev`) contains the trading/Moneycontrol work. The `main` branch keeps the stable core RSS bot.

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
3. For trading updates, add a separate Moneycontrol channel and set `CHANNEL_MONEYCONTROL`

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
CHANNEL_MONEYCONTROL=1234567890123456789

# OR use one channel for everything
CHANNEL_ALL=1234567890123456789

# Optional: override default Moneycontrol topic URLs (comma-separated)
# MONEYCONTROL_SECTION_URLS=https://www.moneycontrol.com/news/tags/small-cap.html,https://www.moneycontrol.com/news/tags/bank-stocks.html,https://www.moneycontrol.com/news/tags/oil-and-gas.html
# Optional: override Moneycontrol article count per poll (1-50)
# MONEYCONTROL_MAX_ARTICLES_PER_FETCH=12

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
    name: "AI News",
    emoji: "🤖",
    color: 0x7289da,
    feeds: [
      "https://your-new-feed-url.com/rss",
      // Add more feeds here
    ],
  },
  // Add new categories...
};
```

### Adjust Article Limits

In `src/config/feeds.js`:

- `MAX_ARTICLES_PER_FETCH`: How many articles per category per run
- `REDIS_EXPIRY_DAYS`: How long to remember posted articles

### Moneycontrol Price Embed

Moneycontrol posts use a market-style embed layout with:

- Title
- Subtitle (story summary)
- Previous Day Price
- Current Day Price
- Next Day Predicted Price

Color signal is based on **predicted vs current**:

- 🟢 Green: predicted price is higher (profit expectation)
- 🔴 Red: predicted price is lower (loss expectation)
- 🟠 Orange: predicted price is unchanged or unavailable

If a Moneycontrol item has no image, it can still be posted as a text-first embed.

By default, the bot uses Google News RSS queries scoped to `site:moneycontrol.com` for stability.

If you explicitly set `MONEYCONTROL_SECTION_URLS`, the bot will attempt direct Moneycontrol scraping; some regions/IPs may receive HTTP 403 from those pages.

When Moneycontrol updates come from Google RSS links, the bot now enriches each item using page metadata (`og:image`, `twitter:image`) so thumbnails are included whenever available.

Active production trading stack for the `moneycontrol` category includes:

- Moneycontrol (via Google News RSS query fallbacks)
- Economic Times markets/banking/energy RSS
- Investing.com India RSS
- Business Standard markets/banking/commodities RSS

Note: the previously shared LiveMint RSS endpoints (`/rss/marketsRSS`, `/rss/companiesRSS`, `/rss/industryRSS`) currently return 404 in runtime checks, so they are not enabled by default.

When a story does not include enough quote-like data, price fields are shown as `N/A` and the signal defaults to 🟠.

### Branch Usage

- `main`: stable bot for the core RSS categories
- `dev`: active trading/Moneycontrol branch with market-style embeds and extra source fallbacks

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
