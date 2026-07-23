# CLAUDE.md

This file provides guidance for AI coding assistants working in this repository.

## What this is

A browser-based, open-source daily news dashboard with no backend server. A GitHub Actions cron job fetches news twice daily (at 6:00 AM CDT and 5:30 PM CDT) and commits the results as static JSON (`data/news.json`); the frontend (`index.html`, `style.css`, `app.js`) reads that JSON.

## Commands

```bash
npm install
npm run fetch-news   # runs scripts/fetch-news.mjs, regenerates data/news.json from RSS
npm run serve        # static file server at http://localhost:8080 (scripts/serve.mjs)
```

`index.html` must be loaded via `npm run serve` (or any static server) — not `file://` — because `app.js` fetches `data/news.json`, which browsers block under the file protocol.

## Architecture

There is exactly one source of real news data: `data/topics.json` → `data/news.json`.
- `scripts/fetch-news.mjs` runs server-side (locally or in CI), fetches each topic via `rss-parser`, and writes the merged result to `data/news.json`.
- Topics in `data/topics.json` support both Google News search queries (`query`) and direct RSS/Atom URLs (`feedUrl`).
- `.github/workflows/fetch-news.yml` runs on a twice-daily cron (6:00 AM CDT: `0 11 * * *` and 5:30 PM CDT: `30 22 * * *`) and commits `data/news.json` directly to `main`.
- `app.js` handles client-side features: theme switcher (Dark/Light), category tabs filtering, live search filtering, title deduplication with combined source links, and 1-click GitHub Issue/PR topic proposals.

## Key Constraints & Gotchas

- Topic items in `data/topics.json` can have `feedUrl` (direct RSS/Atom), `query` (Google News search), or `query: null` (Google News top headlines).
- `fetch-news.mjs` fetches topics sequentially to stay gentle on feed sources and keep CI logs readable.
- The 1-click topic submission uses GitHub web URLs (`/issues/new` and `/edit/main/data/topics.json`), avoiding client-side GitHub token requirements.
