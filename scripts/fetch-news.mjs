import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Parser from "rss-parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOPICS_PATH = path.join(__dirname, "..", "data", "topics.json");
const OUTPUT_PATH = path.join(__dirname, "..", "data", "news.json");
const ITEMS_PER_TOPIC = 12;

const parser = new Parser({ timeout: 15000 });

function feedUrlFor(query) {
  if (!query) {
    // No query -> Google News top headlines (US, English)
    return "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en";
  }
  const q = encodeURIComponent(query);
  return `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
}

function cleanItem(item) {
  return {
    title: item.title?.trim() ?? "(untitled)",
    link: item.link ?? "",
    source: item.creator || item.source?.title || (item.title?.match(/- ([^-]+)$/)?.[1]?.trim()) || "",
    pubDate: item.pubDate ?? item.isoDate ?? null,
  };
}

async function fetchTopic(topic) {
  const url = feedUrlFor(topic.query);
  try {
    const feed = await parser.parseURL(url);
    const items = (feed.items ?? []).slice(0, ITEMS_PER_TOPIC).map(cleanItem);
    return { id: topic.id, label: topic.label, query: topic.query, items, error: null };
  } catch (err) {
    console.error(`[fetch-news] Failed to fetch topic "${topic.id}": ${err.message}`);
    return { id: topic.id, label: topic.label, query: topic.query, items: [], error: err.message };
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
