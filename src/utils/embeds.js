import pkg from 'discord.js';
const { MessageEmbed } = pkg;
import { NEWS_FEEDS } from '../config/feeds.js';

export function createNewsEmbed(article) {
  if (!article.image) {
    throw new Error('Article has no image - should not reach here');
  }

  const config = NEWS_FEEDS[article.category];
  
  const embed = new MessageEmbed()
    .setColor(config.color)
    .setTitle(truncate(article.title, 256))
    .setURL(article.link)
    .setDescription(article.description || '')
    .setImage(article.image)
    .setTimestamp(new Date(article.pubDate));

  return embed;
}

function truncate(text, maxLength) {
  if (!text) return 'No Title';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}
