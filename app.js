const NEWS_JSON_URL = "data/news.json";
const QUEUED_TOPICS_KEY = "osnews.queuedTopics";

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

function loadQueuedTopics() {
  try {
    return JSON.parse(localStorage.getItem(QUEUED_TOPICS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveQueuedTopics(topics) {
  localStorage.setItem(QUEUED_TOPICS_KEY, JSON.stringify(topics));
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function renderTopicCard(topic) {
  const card = document.createElement("section");
  card.className = "topic-card";
  card.dataset.topicId = topic.id;

  const header = document.createElement("div");
  header.className = "topic-card__header";

  const h2 = document.createElement("h2");
  h2.textContent = topic.label;
  header.appendChild(h2);

  card.appendChild(header);

  if (!topic.items || topic.items.length === 0) {
    const p = document.createElement("p");
    p.className = "topic-empty";
    p.textContent = "No stories found yet.";
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

function renderQueuedTopicCard(topic) {
  const card = document.createElement("section");
  card.className = "topic-card queued-topic";
  card.dataset.topicId = topic.id;

  const header = document.createElement("div");
  header.className = "topic-card__header";

  const h2 = document.createElement("h2");
  h2.textContent = topic.label;
  header.appendChild(h2);

  const tag = document.createElement("span");
  tag.className = "topic-tag";
  tag.textContent = "queued";
  header.appendChild(tag);

  const removeBtn = document.createElement("button");
  removeBtn.className = "remove-topic";
  removeBtn.type = "button";
  removeBtn.textContent = "Remove";
  removeBtn.addEventListener("click", () => removeQueuedTopic(topic.id));
  header.appendChild(removeBtn);

  card.appendChild(header);

  const explainer = document.createElement("p");
  explainer.className = "topic-empty";
  explainer.textContent =
    "Not fetched yet — this topic is saved in your browser only. To include it in the twice-daily " +
    "background refresh, add the snippet below to data/topics.json.";
  card.appendChild(explainer);

  const snippet = JSON.stringify({ id: topic.slug, label: topic.label, query: topic.query }, null, 2);
  const pre = document.createElement("pre");
  pre.className = "topic-snippet";
  pre.textContent = snippet;
  card.appendChild(pre);

  const copyBtn = document.createElement("button");
  copyBtn.className = "copy-snippet";
  copyBtn.type = "button";
  copyBtn.textContent = "Copy JSON";
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      copyBtn.textContent = "Copied!";
      setTimeout(() => (copyBtn.textContent = "Copy JSON"), 1500);
    } catch {
      copyBtn.textContent = "Couldn't copy";
    }
  });
  card.appendChild(copyBtn);

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

  const queuedTopics = loadQueuedTopics();

  if (baseData.topics.length === 0 && queuedTopics.length === 0) {
    statusMessage.textContent = "No news yet. Run the fetch job or add a topic above.";
  } else {
    statusMessage.remove();
  }

  for (const topic of baseData.topics) {
    dashboard.appendChild(renderTopicCard(topic));
  }

  for (const topic of queuedTopics) {
    dashboard.appendChild(renderQueuedTopicCard(topic));
  }
}

function removeQueuedTopic(id) {
  const topics = loadQueuedTopics().filter((t) => t.id !== id);
  saveQueuedTopics(topics);
  init();
}

function highlightTopicCard(id) {
  const card = dashboard.querySelector(`[data-topic-id="${CSS.escape(id)}"]`);
  if (!card) return;
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  card.classList.add("just-added");
  setTimeout(() => card.classList.remove("just-added"), 2000);
}

async function addQueuedTopic(rawQuery) {
  const query = rawQuery.trim();
  if (!query) return;

  const slug = slugify(query);
  const id = "queued-" + slug;
  searchInput.value = "";

  const existing = loadQueuedTopics().find((t) => t.id === id);
  if (!existing) {
    const topic = { id, slug, label: query, query };
    const topics = loadQueuedTopics();
    topics.push(topic);
    saveQueuedTopics(topics);
    await init();
  }

  highlightTopicCard(id);
}

searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  addQueuedTopic(searchInput.value);
});

init();
