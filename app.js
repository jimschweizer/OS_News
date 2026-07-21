const NEWS_JSON_URL = "data/news.json";
// Free CORS proxies are individually unreliable, so try each in turn with a short timeout.
const CORS_PROXIES = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
];
const PROXY_TIMEOUT_MS = 8000;
const CUSTOM_TOPICS_KEY = "osnews.customTopics";
const CUSTOM_TOPIC_MAX_AGE_MS = 12 * 60 * 60 * 1000; // re-fetch custom topics after 12h
const ITEMS_PER_TOPIC = 12;

const dashboard = document.getElementById("dashboard");
const statusMessage = document.getElementById("status-message");
const lastUpdated = document.getElementById("last-updated");
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || `topic-${Date.now()}`;
}

function loadCustomTopics() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_TOPICS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveCustomTopics(topics) {
  localStorage.setItem(CUSTOM_TOPICS_KEY, JSON.stringify(topics));
}

function googleNewsRssUrl(query) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
}

async function fetchViaProxy(buildProxyUrl, feedUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
  try {
    const response = await fetch(buildProxyUrl(feedUrl), { signal: controller.signal });
    if (!response.ok) throw new Error(`Proxy request failed (${response.status})`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchLiveTopic(query) {
  const feedUrl = googleNewsRssUrl(query);

  let xmlText = null;
  let lastError = null;
  for (const buildProxyUrl of CORS_PROXIES) {
    try {
      xmlText = await fetchViaProxy(buildProxyUrl, feedUrl);
      break;
    } catch (err) {
      lastError = err;
    }
  }
  if (xmlText === null) {
    throw new Error(`All proxies failed (${lastError?.message ?? "unknown error"})`);
  }

  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  if (doc.querySelector("parsererror")) throw new Error("Could not parse RSS feed");

  const items = Array.from(doc.querySelectorAll("item")).slice(0, ITEMS_PER_TOPIC).map((item) => {
    const title = item.querySelector("title")?.textContent?.trim() || "(untitled)";
    const link = item.querySelector("link")?.textContent?.trim() || "";
    const pubDate = item.querySelector("pubDate")?.textContent?.trim() || null;
    const sourceMatch = title.match(/- ([^-]+)$/);
    return { title, link, pubDate, source: sourceMatch ? sourceMatch[1].trim() : "" };
  });

  return items;
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function renderTopicCard(topic, { custom = false, onRemove = null } = {}) {
  const card = document.createElement("section");
  card.className = "topic-card" + (custom ? " custom-topic" : "");
  card.dataset.topicId = topic.id;

  const header = document.createElement("div");
  header.className = "topic-card__header";

  const h2 = document.createElement("h2");
  h2.textContent = topic.label;
  header.appendChild(h2);

  if (custom) {
    const tag = document.createElement("span");
    tag.className = "topic-tag";
    tag.textContent = "custom";
    header.appendChild(tag);

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-topic";
    removeBtn.type = "button";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => onRemove?.());
    header.appendChild(removeBtn);
  }

  card.appendChild(header);

  if (topic.error) {
    const p = document.createElement("p");
    p.className = "topic-empty";
    p.textContent = `Couldn't load this topic: ${topic.error}`;
    card.appendChild(p);
    return card;
  }

  if (!topic.items || topic.items.length === 0) {
    const p = document.createElement("p");
    p.className = "topic-empty";
    p.textContent = custom && !topic.fetchedAt ? "Loading live results…" : "No stories found yet.";
    card.appendChild(p);
    return card;
  }

  const list = document.createElement("ul");
  list.className = "news-list";
  for (const item of topic.items) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = item.link || "#";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = item.title;
    li.appendChild(a);

    const meta = document.createElement("span");
    meta.className = "news-meta";
    meta.textContent = [item.source, formatDate(item.pubDate)].filter(Boolean).join(" · ");
    li.appendChild(meta);

    list.appendChild(li);
  }
  card.appendChild(list);
  return card;
}

async function init() {
  let baseData = { generatedAt: null, topics: [] };
  try {
    const res = await fetch(NEWS_JSON_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    baseData = await res.json();
  } catch (err) {
    console.error("Failed to load base news.json", err);
  }

  dashboard.innerHTML = "";

  if (baseData.generatedAt) {
    lastUpdated.textContent = `Last background refresh: ${new Date(baseData.generatedAt).toLocaleString()}`;
  } else {
    lastUpdated.textContent = "Background refresh data not available yet.";
  }

  if (baseData.topics.length === 0 && loadCustomTopics().length === 0) {
    statusMessage.textContent = "No news yet. Run the fetch job or add a topic above.";
  } else {
    statusMessage.remove();
  }

  for (const topic of baseData.topics) {
    dashboard.appendChild(renderTopicCard(topic));
  }

  await renderCustomTopics();
}

async function renderCustomTopics() {
  const customTopics = loadCustomTopics();
  const now = Date.now();

  for (const topic of customTopics) {
    const card = renderTopicCard(topic, {
      custom: true,
      onRemove: () => removeCustomTopic(topic.id),
    });
    dashboard.appendChild(card);

    const isStale = !topic.fetchedAt || now - topic.fetchedAt > CUSTOM_TOPIC_MAX_AGE_MS;
    if (isStale) {
      refreshCustomTopic(topic, card);
    }
  }
}

async function refreshCustomTopic(topic, cardEl) {
  try {
    const items = await fetchLiveTopic(topic.query);
    topic.items = items;
    topic.error = null;
    topic.fetchedAt = Date.now();
  } catch (err) {
    console.error(`Live fetch failed for "${topic.label}"`, err);
    topic.error = err.message;
  }
  persistCustomTopic(topic);

  const refreshed = renderTopicCard(topic, { custom: true, onRemove: () => removeCustomTopic(topic.id) });
  cardEl.replaceWith(refreshed);
}

function persistCustomTopic(topic) {
  const topics = loadCustomTopics();
  const idx = topics.findIndex((t) => t.id === topic.id);
  if (idx >= 0) topics[idx] = topic;
  saveCustomTopics(topics);
}

function removeCustomTopic(id) {
  const topics = loadCustomTopics().filter((t) => t.id !== id);
  saveCustomTopics(topics);
  init();
}

function highlightTopicCard(id) {
  const card = dashboard.querySelector(`[data-topic-id="${CSS.escape(id)}"]`);
  if (!card) return;
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  card.classList.add("just-added");
  setTimeout(() => card.classList.remove("just-added"), 2000);
}

async function addCustomTopic(rawQuery) {
  const query = rawQuery.trim();
  if (!query) return;

  const id = "custom-" + slugify(query);
  const existing = loadCustomTopics().find((t) => t.id === id);
  searchInput.value = "";

  if (!existing) {
    const topic = { id, label: query, query, items: [], error: null, fetchedAt: null };
    const topics = loadCustomTopics();
    topics.push(topic);
    saveCustomTopics(topics);
    await init();
  }

  highlightTopicCard(id);
}

searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  addCustomTopic(searchInput.value);
});

init();
