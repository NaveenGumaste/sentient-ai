import pkg from "discord.js";
const { MessageEmbed } = pkg;
import { NEWS_FEEDS } from "../config/feeds.js";

export function createNewsEmbed(article) {
  const config = NEWS_FEEDS[article.category] || { color: 0x7289da };

  if (article.category === "moneycontrol") {
    return createMoneycontrolEmbed(article);
  }

  const embed = new MessageEmbed()
    .setColor(config.color)
    .setTitle(truncate(article.title, 256))
    .setURL(article.link)
    .setDescription(article.description || "")
    .setTimestamp(new Date(article.pubDate));

  if (article.image) {
    embed.setImage(article.image);
  }

  return embed;
}

function createMoneycontrolEmbed(article) {
  const trend = resolveTrend(article);
  const subtitle =
    article.subtitle || article.description || "No story summary available.";

  const embed = new MessageEmbed()
    .setColor(trend.color)
    .setTitle(truncate(article.title, 256))
    .setURL(article.link)
    .setDescription(truncate(subtitle, 700))
    .addFields(
      {
        name: "Previous Day Price",
        value: formatPrice(article.previousPrice),
        inline: true,
      },
      {
        name: "Current Day Price",
        value: formatPrice(article.currentPrice),
        inline: true,
      },
      {
        name: "Next Day Predicted Price",
        value: `${trend.emoji} ${formatPrice(article.predictedPrice)}`,
        inline: true,
      },
      {
        name: "Prediction Signal",
        value: `${trend.emoji} **${trend.label}**`,
        inline: false,
      },
    )
    .setTimestamp(new Date(article.pubDate));

  if (article.image) {
    embed.setImage(article.image);
  }

  if (article.source) {
    embed.setFooter({ text: `Source: ${article.source}` });
  }

  return embed;
}

function resolveTrend(article) {
  const currentPrice = toNumeric(article.currentPrice);
  const predictedPrice = toNumeric(article.predictedPrice);

  const status =
    article.trendStatus ||
    (() => {
      if (currentPrice == null || predictedPrice == null) return "same";
      if (predictedPrice > currentPrice) return "profit";
      if (predictedPrice < currentPrice) return "loss";
      return "same";
    })();

  if (status === "profit") {
    return { label: "Profit expected", emoji: "🟢", color: 0x2ecc71 };
  }

  if (status === "loss") {
    return { label: "Loss expected", emoji: "🔴", color: 0xe74c3c };
  }

  return { label: "No major change", emoji: "🟠", color: 0xf39c12 };
}

function formatPrice(value) {
  const numeric = toNumeric(value);
  if (numeric == null) return "N/A";

  return `₹${numeric.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function toNumeric(value) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function truncate(text, maxLength) {
  if (!text) return "No Title";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}
