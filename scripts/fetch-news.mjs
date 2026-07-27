import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Parser from "rss-parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOPICS_PATH = path.join(__dirname, "..", "data", "topics.json");
const OUTPUT_PATH = path.join(__dirname, "..", "data", "news.json");
const ITEMS_PER_TOPIC = 12;
const MAX_ITEM_AGE_DAYS = 7;
const MAX_ITEM_AGE_MS = MAX_ITEM_AGE_DAYS * 24 * 60 * 60 * 1000;

const parser = new Parser({ timeout: 15000 });

function feedUrlFor(query) {
  if (!query) {
    // No query -> Google News top headlines (US, English)
    return "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en";
  }
  const q = encodeURIComponent(query);
  return `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
}

function getDomainSource(link) {
  try {
    const host = new URL(link).hostname.replace(/^www\./, "");
    return host;
  } catch {
    return "";
  }
}

// Keeps items published within MAX_ITEM_AGE_DAYS. Items with a missing or
// unparseable pubDate are kept, since we can't confirm they're stale (some
// direct RSS/Atom feeds omit dates) and dropping them would risk hiding
// legitimate current stories.
function isWithinMaxAge(pubDate, now = Date.now()) {
  if (!pubDate) return true;
  const published = new Date(pubDate).getTime();
  if (Number.isNaN(published)) return true;
  return now - published <= MAX_ITEM_AGE_MS;
}

function cleanItem(item, feedTitle = "") {
  let source = item.creator || item.source?.title || (item.title?.match(/- ([^-]+)$/)?.[1]?.trim()) || feedTitle || "";
  if (!source && item.link) {
    source = getDomainSource(item.link);
  }
  return {
    title: item.title?.trim() ?? "(untitled)",
    link: item.link ?? "",
    source,
    pubDate: item.pubDate ?? item.isoDate ?? null,
  };
}

async function fetchTopic(topic) {
  const url = topic.feedUrl || feedUrlFor(topic.query);
  try {
    const feed = await parser.parseURL(url);
    const feedTitle = feed.title?.trim() || "";
    const now = Date.now();
    const allItems = (feed.items ?? []).map((item) => cleanItem(item, feedTitle));
    const freshItems = allItems.filter((item) => isWithinMaxAge(item.pubDate, now));
    const staleCount = allItems.length - freshItems.length;
    if (staleCount > 0) {
      console.log(`[fetch-news] Topic "${topic.id}": dropped ${staleCount} item(s) older than ${MAX_ITEM_AGE_DAYS} days`);
    }
    const items = freshItems.slice(0, ITEMS_PER_TOPIC);
    return {
      id: topic.id,
      label: topic.label,
      category: topic.category || "General",
      query: topic.query ?? null,
      feedUrl: topic.feedUrl ?? null,
      items,
      error: null,
    };
  } catch (err) {
    console.error(`[fetch-news] Failed to fetch topic "${topic.id}": ${err.message}`);
    return {
      id: topic.id,
      label: topic.label,
      category: topic.category || "General",
      query: topic.query ?? null,
      feedUrl: topic.feedUrl ?? null,
      items: [],
      error: err.message,
    };
  }
}

async function main() {
  const topics = JSON.parse(await readFile(TOPICS_PATH, "utf-8"));

  // Sequential fetch: gentle on Google News, and easier to read in CI logs.
  const results = [];
  for (const topic of topics) {
    results.push(await fetchTopic(topic));
  }

  const output = {
    generatedAt: new Date().toISOString(),
    topics: results,
  };

  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n", "utf-8");

  const total = results.reduce((sum, t) => sum + t.items.length, 0);
  const failed = results.filter((t) => t.error).length;
  console.log(`[fetch-news] Wrote ${total} items across ${results.length} topics (${failed} failed) to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
