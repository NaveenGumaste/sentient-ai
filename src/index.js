import pkg from 'discord.js';
const { Client, Intents } = pkg;
import 'dotenv/config';

import { fetchNewsByCategory } from './services/news.js';
import { redisService } from './services/redis.js';
import { createNewsEmbed } from './utils/embeds.js';
import { NEWS_FEEDS } from './config/feeds.js';

const client = new Client({
  intents: [Intents.FLAGS.GUILDS]
});

const DEFAULT_POLL_INTERVAL_MS = 60_000;
const POLL_INTERVAL_MS = getPollIntervalMs();

// Map categories to their channel env variables
const CHANNEL_MAP = {
  ai: 'CHANNEL_AI',
  llm: 'CHANNEL_LLM',
  tech: 'CHANNEL_TECH',
  opensource: 'CHANNEL_OPENSOURCE'
};

function getChannelId(category) {
  // First check for category-specific channel
  const specificChannel = process.env[CHANNEL_MAP[category]];
  if (specificChannel) return specificChannel;
  
  // Fallback to general channel
  return process.env.CHANNEL_ALL;
}

async function postNewsToChannel(category) {
  const channelId = getChannelId(category);
  if (!channelId) {
    console.log(`No channel configured for ${category}, skipping...`);
    return;
  }

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) {
    console.error(`Could not fetch channel ${channelId} for ${category}`);
    return;
  }

  console.log(`\n📡 Fetching ${NEWS_FEEDS[category].name}...`);

  const articles = await fetchNewsByCategory(category);
  const newArticles = await redisService.filterNewArticles(articles);

  // Filter to only articles with valid images (extra safety check)
  const articlesWithImages = newArticles.filter(article => {
    if (!article.image || typeof article.image !== 'string') {
      console.log(`⏭️  Skipping (no image): ${article.title.slice(0, 40)}...`);
      return false;
    }

    // Ensure it's a valid image URL
    if (!article.image.startsWith('http')) {
      console.log(`⏭️  Skipping (invalid image URL): ${article.title.slice(0, 40)}...`);
      return false;
    }

    return true;
  });

  console.log(`Found ${articlesWithImages.length} articles with images out of ${newArticles.length} new articles`);

  for (const article of articlesWithImages) {
    try {
      const embed = createNewsEmbed(article);
      await channel.send({ embeds: [embed] });
      await redisService.markArticleAsPosted(article);
      console.log(`✅ Posted: ${article.title.slice(0, 50)}...`);

      // Small delay to avoid rate limits
      await sleep(1000);
    } catch (error) {
      console.error(`Failed to post article: ${error.message}`);
    }
  }
}

async function runNewsFetch() {
  console.log('\n' + '='.repeat(50));
  console.log(`🕐 Starting news fetch at ${new Date().toISOString()}`);
  console.log('='.repeat(50));

  await Promise.allSettled(Object.keys(NEWS_FEEDS).map(category => postNewsToChannel(category)));

  console.log('\n✨ News fetch completed!\n');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getPollIntervalMs() {
  const parsed = Number(process.env.POLL_INTERVAL_MS);
  if (Number.isFinite(parsed) && parsed >= 5000) {
    return parsed;
  }

  return DEFAULT_POLL_INTERVAL_MS;
}

async function runPollingLoop() {
  while (true) {
    try {
      await runNewsFetch();
    } catch (error) {
      console.error('Polling cycle failed:', error);
    }

    console.log(`\n⏳ Waiting ${Math.round(POLL_INTERVAL_MS / 1000)} second(s) before the next check...`);
    await sleep(POLL_INTERVAL_MS);
  }
}

// Bot ready event
client.once('ready', async (c) => {
  console.log(`\n🤖 Discord News Bot is online!`);
  console.log(`   Logged in as: ${c.user.tag}`);
  console.log(`   Serving ${c.guilds.cache.size} server(s)`);

  console.log(`\n🔁 Polling feeds continuously every ${Math.round(POLL_INTERVAL_MS / 1000)} second(s)...`);
  runPollingLoop().catch(error => {
    console.error('Polling loop stopped unexpectedly:', error);
    process.exitCode = 1;
  });
});

// Error handling
client.on('error', error => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

// Start the bot
console.log('🔌 Connecting to Discord...');
client.login(process.env.DISCORD_TOKEN);
