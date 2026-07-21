# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A browser-based news dashboard with no backend server. A GitHub Actions cron job fetches
Google News RSS feeds twice daily and commits the results as static JSON; the frontend is
plain HTML/CSS/JS that reads that JSON. See README.md for user-facing setup/deploy docs.

## Commands

```bash
npm install
npm run fetch-news   # runs scripts/fetch-news.mjs, regenerates data/news.json from RSS
npm run serve        # static file server at http://localhost:8080 (scripts/serve.mjs)
```

There is no build step, test suite, or linter. `index.html` must be loaded via
`npm run serve` (or any static server) — not `file://` — because `app.js` does a `fetch()`
of `data/news.json`, which browsers block under the file protocol.

## Architecture

Two independent data paths feed the same `#dashboard` grid in `app.js`:

1. **Background topics** (`data/topics.json` → `data/news.json`): `scripts/fetch-news.mjs`
   runs server-side (locally or in CI), fetches each topic's Google News RSS feed via
   `rss-parser`, and writes the merged result to `data/news.json`. `.github/workflows/fetch-news.yml`
   runs this on a twice-daily cron (`workflow_dispatch` also available) and commits the
   updated JSON directly to the branch — this is what makes GitHub Pages serve fresh data
   without any server. `app.js` just fetches `data/news.json` on page load.

2. **Custom topics** (search box → `localStorage`): adding a topic in the UI does **not**
   touch `data/topics.json`. It's stored client-side only (`osnews.customTopics` in
   `localStorage`), fetched live in-browser via a public CORS proxy
   (`api.allorigins.win`, since Google News RSS has no CORS headers) and parsed with
   `DOMParser` — duplicating the parsing logic in `scripts/fetch-news.mjs` but in the
   browser instead of Node. Custom topics auto-refresh after 12h and are per-browser, not
   shared or synced back to the repo. If a topic should be part of the permanent
   twice-daily set, add it to `data/topics.json` by hand.

Both paths converge on the same `renderTopicCard()` in `app.js`, which is why topic
objects from either source share the same shape: `{ id, label, items: [{title, link,
source, pubDate}], error }`.

## Gotchas

- The `headlines` topic in `data/topics.json` has `query: null`, which
  `feedUrlFor()`/`googleNewsRssUrl()` special-case to Google's top-stories feed instead of
  a search query — don't assume every topic has a query string.
- The CI cron schedule is fixed UTC and does not adjust for US Central daylight saving;
  actual local fetch times drift by an hour twice a year (documented in README.md).
- `fetch-news.mjs` fetches topics sequentially (not `Promise.all`) intentionally, to stay
  gentle on Google News and keep CI logs readable in order — don't parallelize without
  reason to.
