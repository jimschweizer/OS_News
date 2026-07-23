const NEWS_JSON_URL = "data/news.json";
const QUEUED_TOPICS_KEY = "osnews.queuedTopics";
const THEME_KEY = "osnews.theme";
const DEFAULT_REPO_URL = "https://github.com/jimschweizer/OS_News";

// DOM Elements
const dashboard = document.getElementById("dashboard");
const lastUpdated = document.getElementById("last-updated");
const repoLink = document.getElementById("repo-link");
const themeToggle = document.getElementById("theme-toggle");

const toggleSubmitBtn = document.getElementById("toggle-submit-panel");
const submitPanel = document.getElementById("topic-submit-panel");
const closeSubmitBtn = document.getElementById("close-submit-panel");
const proposeForm = document.getElementById("propose-topic-form");
const topicInput = document.getElementById("topic-input");
const topicCategorySelect = document.getElementById("topic-category");

const btnGhIssue = document.getElementById("btn-gh-issue");
const btnGhPr = document.getElementById("btn-gh-pr");
const btnLocalQueue = document.getElementById("btn-local-queue");
const btnCopyJson = document.getElementById("btn-copy-json");

const categoryTabsContainer = document.getElementById("category-tabs");
const searchFilter = document.getElementById("search-filter");
const clearSearchBtn = document.getElementById("clear-search");
const dedupToggle = document.getElementById("dedup-toggle");

// State
let rawNewsData = { generatedAt: null, topics: [] };
let activeCategory = "all";
let filterQuery = "";
let isDedupEnabled = true;

// 1. Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme) {
    document.documentElement.setAttribute("data-theme", savedTheme);
  } else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-theme", prefersDark ? "dark" : "light");
  }

  themeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
  });
}

// 2. Repository Link Helper
function getRepoUrl() {
  const host = window.location.hostname;
  if (host.endsWith(".github.io")) {
    const owner = host.split(".")[0];
    const pathSegments = window.location.pathname.split("/").filter(Boolean);
    const repo = pathSegments[0] || "OS_News";
    return `https://github.com/${owner}/${repo}`;
  }
  return DEFAULT_REPO_URL;
}

function initRepoLinks() {
  const url = getRepoUrl();
  if (repoLink) repoLink.href = url;
}

// 3. Topic Submission Panel & GitHub Automation
function initSubmitPanel() {
  toggleSubmitBtn.addEventListener("click", () => {
    const isHidden = submitPanel.classList.toggle("hidden");
    toggleSubmitBtn.setAttribute("aria-expanded", !isHidden);
    if (!isHidden) topicInput.focus();
  });

  closeSubmitBtn.addEventListener("click", () => {
    submitPanel.classList.add("hidden");
    toggleSubmitBtn.setAttribute("aria-expanded", "false");
  });

  function buildTopicObject() {
    const val = topicInput.value.trim();
    if (!val) return null;
    const category = topicCategorySelect.value || "General";
    const slug = slugify(val);

    const isUrl = /^https?:\/\//i.test(val);
    if (isUrl) {
      return {
        id: slug,
        label: val.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] + " Feed",
        category,
        feedUrl: val,
      };
    }
    return {
      id: slug,
      label: val,
      category,
      query: val,
    };
  }

  // Submit via GitHub Issue
  btnGhIssue.addEventListener("click", () => {
    const topicObj = buildTopicObject();
    if (!topicObj) {
      alert("Please enter a search query or RSS URL.");
      return;
    }
    const repo = getRepoUrl();
    const title = encodeURIComponent(`Add Topic: ${topicObj.label}`);
    const snippet = JSON.stringify(topicObj, null, 2);
    const body = encodeURIComponent(
      `### Proposed New OS News Topic\n\n\`\`\`json\n${snippet}\n\`\`\`\n\n*Submitted via OS News Dashboard 1-Click Action.*`
    );
    window.open(`${repo}/issues/new?title=${title}&body=${body}`, "_blank");
  });

  // 1-Click PR (GitHub Edit File)
  btnGhPr.addEventListener("click", () => {
    const topicObj = buildTopicObject();
    if (!topicObj) {
      alert("Please enter a search query or RSS URL.");
      return;
    }
    const repo = getRepoUrl();
    const snippet = JSON.stringify(topicObj, null, 2);
    navigator.clipboard.writeText(snippet).then(() => {
      alert(`Copied JSON snippet for "${topicObj.label}" to clipboard!\nOpening GitHub file editor...`);
      window.open(`${repo}/edit/main/data/topics.json`, "_blank");
    }).catch(() => {
      window.open(`${repo}/edit/main/data/topics.json`, "_blank");
    });
  });

  // Copy JSON Snippet
  btnCopyJson.addEventListener("click", async () => {
    const topicObj = buildTopicObject();
    if (!topicObj) return;
    const snippet = JSON.stringify(topicObj, null, 2);
    try {
      await navigator.clipboard.writeText(snippet);
      btnCopyJson.textContent = "Copied!";
      setTimeout(() => (btnCopyJson.textContent = "Copy JSON Snippet"), 1800);
    } catch {
      alert(snippet);
    }
  });

  // Local Storage Queue Fallback
  proposeForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const topicObj = buildTopicObject();
    if (!topicObj) return;
    topicObj.id = "queued-" + topicObj.id;

    const queued = loadQueuedTopics();
    if (!queued.some((t) => t.id === topicObj.id)) {
      queued.push(topicObj);
      saveQueuedTopics(queued);
    }
    topicInput.value = "";
    submitPanel.classList.add("hidden");
    renderDashboard();
  });
}

// 4. Utility Functions
function slugify(text) {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || `topic-${Date.now()}`
  );
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

// 5. Deduplication Engine
function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/- [^-]+$/, "") // remove source suffix e.g. "- BBC"
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

function isSimilar(titleA, titleB) {
  const normA = normalizeTitle(titleA);
  const normB = normalizeTitle(titleB);
  if (normA === normB) return true;
  if (!normA || !normB) return false;

  const wordsA = new Set(normA.split(/\s+/).filter((w) => w.length > 3));
  const wordsB = new Set(normB.split(/\s+/).filter((w) => w.length > 3));

  if (wordsA.size === 0 || wordsB.size === 0) return false;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }

  const union = new Set([...wordsA, ...wordsB]).size;
  const similarity = intersection / union;
  return similarity >= 0.65;
}

function deduplicateTopicItems(items) {
  if (!isDedupEnabled || !items || items.length === 0) return items.map((item) => ({ main: item, alternatives: [] }));

  const clusters = [];
  for (const item of items) {
    let matchedCluster = null;
    for (const cluster of clusters) {
      if (isSimilar(cluster.main.title, item.title)) {
        matchedCluster = cluster;
        break;
      }
    }
    if (matchedCluster) {
      matchedCluster.alternatives.push(item);
    } else {
      clusters.push({ main: item, alternatives: [] });
    }
  }
  return clusters;
}

// 6. Category Tabs Renderer
function renderCategoryTabs() {
  const categoriesSet = new Set();
  for (const topic of rawNewsData.topics) {
    if (topic.category) categoriesSet.add(topic.category);
  }
  const queued = loadQueuedTopics();
  for (const t of queued) {
    if (t.category) categoriesSet.add(t.category);
  }

  const categories = Array.from(categoriesSet).sort();

  categoryTabsContainer.innerHTML = "";

  const allBtn = document.createElement("button");
  allBtn.className = `tab-btn ${activeCategory === "all" ? "active" : ""}`;
  allBtn.dataset.category = "all";
  allBtn.textContent = "All Stories";
  allBtn.addEventListener("click", () => setCategory("all"));
  categoryTabsContainer.appendChild(allBtn);

  for (const cat of categories) {
    const btn = document.createElement("button");
    btn.className = `tab-btn ${activeCategory === cat ? "active" : ""}`;
    btn.dataset.category = cat;
    btn.textContent = cat;
    btn.addEventListener("click", () => setCategory(cat));
    categoryTabsContainer.appendChild(btn);
  }
}

function setCategory(cat) {
  activeCategory = cat;
  renderCategoryTabs();
  renderDashboard();
}

// 7. Render Story Cluster & Topic Cards
function renderStoryCluster(cluster) {
  const li = document.createElement("li");
  li.className = "news-item";

  const a = document.createElement("a");
  a.className = "news-title";
  a.href = cluster.main.link || "#";
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = cluster.main.title;
  li.appendChild(a);

  const metaRow = document.createElement("div");
  metaRow.className = "news-meta-row";

  const metaLeft = document.createElement("span");
  metaLeft.className = "meta-left";
  metaLeft.textContent = [cluster.main.source, formatDate(cluster.main.pubDate)].filter(Boolean).join(" · ");
  metaRow.appendChild(metaLeft);

  if (cluster.alternatives.length > 0) {
    const dedupBtn = document.createElement("button");
    dedupBtn.className = "dedup-badge-btn";
    dedupBtn.type = "button";
    dedupBtn.textContent = `+${cluster.alternatives.length} related`;
    
    const altList = document.createElement("div");
    altList.className = "dedup-sources-list hidden";

    for (const alt of cluster.alternatives) {
      const altLink = document.createElement("a");
      altLink.className = "dedup-link";
      altLink.href = alt.link || "#";
      altLink.target = "_blank";
      altLink.rel = "noopener noreferrer";
      altLink.innerHTML = `<span>${alt.title}</span> <strong class="source-tag">${alt.source || "Source"}</strong>`;
      altList.appendChild(altLink);
    }

    dedupBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const isHidden = altList.classList.toggle("hidden");
      dedupBtn.textContent = isHidden ? `+${cluster.alternatives.length} related` : "Hide related";
    });

    metaRow.appendChild(dedupBtn);
    li.appendChild(metaRow);
    li.appendChild(altList);
  } else {
    li.appendChild(metaRow);
  }

  return li;
}

function renderTopicCard(topic) {
  // Category Filter Check
  if (activeCategory !== "all" && topic.category !== activeCategory) {
    return null;
  }

  // Text Search Filter Check
  let filteredItems = topic.items || [];
  if (filterQuery) {
    const q = filterQuery.toLowerCase();
    const topicMatch = topic.label.toLowerCase().includes(q) || (topic.category && topic.category.toLowerCase().includes(q));
    if (!topicMatch) {
      filteredItems = filteredItems.filter(
        (item) => item.title.toLowerCase().includes(q) || (item.source && item.source.toLowerCase().includes(q))
      );
      if (filteredItems.length === 0) return null;
    }
  }

  const card = document.createElement("section");
  card.className = "topic-card";
  card.dataset.topicId = topic.id;

  const header = document.createElement("div");
  header.className = "topic-card__header";

  const titleGroup = document.createElement("div");
  titleGroup.className = "topic-title-group";

  const h2 = document.createElement("h2");
  h2.textContent = topic.label;
  titleGroup.appendChild(h2);

  if (topic.category) {
    const catTag = document.createElement("span");
    catTag.className = "category-badge";
    catTag.textContent = topic.category;
    titleGroup.appendChild(catTag);
  }

  header.appendChild(titleGroup);
  card.appendChild(header);

  if (!filteredItems || filteredItems.length === 0) {
    const p = document.createElement("p");
    p.className = "topic-empty";
    p.textContent = "No stories matching criteria.";
    card.appendChild(p);
    return card;
  }

  const clusters = deduplicateTopicItems(filteredItems);
  const list = document.createElement("ul");
  list.className = "news-list";
  for (const cluster of clusters) {
    list.appendChild(renderStoryCluster(cluster));
  }

  card.appendChild(list);
  return card;
}

function renderQueuedTopicCard(topic) {
  if (activeCategory !== "all" && topic.category !== activeCategory) {
    return null;
  }

  if (filterQuery) {
    const q = filterQuery.toLowerCase();
    if (!topic.label.toLowerCase().includes(q)) return null;
  }

  const card = document.createElement("section");
  card.className = "topic-card queued-topic";

  const header = document.createElement("div");
  header.className = "topic-card__header";

  const titleGroup = document.createElement("div");
  titleGroup.className = "topic-title-group";

  const h2 = document.createElement("h2");
  h2.textContent = topic.label;
  titleGroup.appendChild(h2);

  const tag = document.createElement("span");
  tag.className = "category-badge";
  tag.textContent = "queued in browser";
  titleGroup.appendChild(tag);

  header.appendChild(titleGroup);

  const removeBtn = document.createElement("button");
  removeBtn.className = "btn-icon";
  removeBtn.type = "button";
  removeBtn.textContent = "✕";
  removeBtn.title = "Remove queued topic";
  removeBtn.addEventListener("click", () => {
    const queued = loadQueuedTopics().filter((t) => t.id !== topic.id);
    saveQueuedTopics(queued);
    renderDashboard();
  });
  header.appendChild(removeBtn);

  card.appendChild(header);

  const p = document.createElement("p");
  p.className = "topic-empty";
  p.textContent = "Saved locally. Click 'Add Topic' above to submit a GitHub Issue or PR to include it in official runs.";
  card.appendChild(p);

  return card;
}

// 8. Main Dashboard Renderer
function renderDashboard() {
  dashboard.innerHTML = "";

  const topicCards = [];
  for (const topic of rawNewsData.topics) {
    const card = renderTopicCard(topic);
    if (card) topicCards.push(card);
  }

  const queued = loadQueuedTopics();
  for (const topic of queued) {
    const card = renderQueuedTopicCard(topic);
    if (card) topicCards.push(card);
  }

  if (topicCards.length === 0) {
    const emptyCard = document.createElement("div");
    emptyCard.className = "status-card";
    emptyCard.innerHTML = `<h3>No stories found</h3><p>Try clearing your filter or selecting another category tab.</p>`;
    dashboard.appendChild(emptyCard);
  } else {
    for (const card of topicCards) {
      dashboard.appendChild(card);
    }
  }
}

// 9. Initializer & Search Filter Event Handling
async function init() {
  initTheme();
  initRepoLinks();
  initSubmitPanel();

  // Search Filter Handler
  searchFilter.addEventListener("input", (e) => {
    filterQuery = e.target.value.trim();
    if (filterQuery) {
      clearSearchBtn.classList.remove("hidden");
    } else {
      clearSearchBtn.classList.add("hidden");
    }
    renderDashboard();
  });

  clearSearchBtn.addEventListener("click", () => {
    searchFilter.value = "";
    filterQuery = "";
    clearSearchBtn.classList.add("hidden");
    renderDashboard();
  });

  // Deduplication Toggle Handler
  dedupToggle.addEventListener("change", (e) => {
    isDedupEnabled = e.target.checked;
    renderDashboard();
  });

  // Fetch JSON
  try {
    const res = await fetch(NEWS_JSON_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    rawNewsData = await res.json();
  } catch (err) {
    console.error("Failed to load news.json", err);
  }

  if (rawNewsData.generatedAt) {
    lastUpdated.textContent = `Last refresh: ${formatDate(rawNewsData.generatedAt)}`;
  } else {
    lastUpdated.textContent = "Background data pending.";
  }

  renderCategoryTabs();
  renderDashboard();
}

init();
