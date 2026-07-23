# OS News — Modern Daily News Dashboard Template

A modern, privacy-first daily news dashboard template designed for personal use, teams, or open-source community hubs. A GitHub Actions workflow fetches news twice daily (at **6:00 AM CDT** and **5:30 PM CDT**) and commits the static dataset as `data/news.json`.

The dashboard runs completely client-side (`index.html` / `style.css` / `app.js`) with zero backend server or API keys required.

## Key Features

- **Modern Dark & Light UI**: Sleek glassmorphic design, custom typography (Outfit & Inter fonts), responsive card grid, and persistent theme switcher.
- **Custom RSS/Atom & Google News Support**: Track Google News search queries (`query`) or direct RSS/Atom URLs (`feedUrl`, e.g., Hacker News, tech blogs, Substack, local papers).
- **Category Tabs**: Group feeds logically into tabs (`Headlines`, `Tech & Science`, `Politics & World`, `Local & Regional`).
- **Live Search & Filtering**: Instant client-side text filter across headlines, sources, and categories.
- **Headline Deduplication**: Automatically groups matching stories across multiple feeds into primary cards with expandable "+ N related sources" combined links.
- **1-Click GitHub Topic Proposing**: Click **Add Topic** to open pre-filled GitHub Issues or 1-click PR links to easily add feeds to `data/topics.json`.

## Topics Configuration

Built-in feeds live in `data/topics.json`. Topics can take a Google News query or a direct RSS/Atom URL:

```json
[
  { "id": "headlines", "label": "Headline News", "category": "Headlines", "query": null },
  { "id": "ai-tech", "label": "AI Tech Stories", "category": "Tech & Science", "query": "artificial intelligence technology" },
  { "id": "hacker-news", "label": "Hacker News", "category": "Tech & Science", "feedUrl": "https://news.ycombinator.com/rss" }
]
```

- `query`: Search term for Google News RSS (`null` pulls Google top headlines).
- `feedUrl`: Direct RSS/Atom feed URL (overrides `query`).
- `category`: Grouping tab name on the dashboard.

## Proposing Topics from Dashboard

Click **Add Topic** in the header. You can:
1. **Submit Issue on GitHub**: Opens a pre-filled GitHub Issue link with the JSON snippet.
2. **1-Click PR (Edit topics.json)**: Copies the JSON snippet and opens GitHub's web file editor directly.
3. **Save in Browser Only**: Queues the topic locally in `localStorage` for testing.
4. **Copy JSON Snippet**: Copies formatted JSON payload.

## Local Development

```bash
npm install
npm run fetch-news   # populates data/news.json
npm run serve        # serves dashboard at http://localhost:8080
```

> **Note**: Open via `http://localhost:8080` (or `npm run serve`), as browsers block `fetch("data/news.json")` over `file://`.

## Deployment

1. Fork/push this repository to GitHub.
2. Go to **Settings → Pages** and choose **Deploy from branch** (`main` / root).
3. The `.github/workflows/fetch-news.yml` schedule runs twice daily at **6:00 AM CDT** (`0 11 * * *`) and **5:30 PM CDT** (`30 22 * * *`) to automatically commit fresh data to GitHub Pages.
