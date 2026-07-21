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

There is exactly one source of real news data: `data/topics.json` → `data/news.json`.
`scripts/fetch-news.mjs` runs server-side (locally or in CI), fetches each topic's Google
News RSS feed via `rss-parser`, and writes the merged result to `data/news.json`.
`.github/workflows/fetch-news.yml` runs this on a twice-daily cron (`workflow_dispatch`
also available) and commits the updated JSON directly to the branch — this is what makes
GitHub Pages serve fresh data without any server. `app.js` fetches `data/news.json` on
page load and renders it via `renderTopicCard()`.

The search box does **not** fetch anything — by design. An earlier version fetched
custom topics live via a public CORS proxy, but free proxies (`allorigins.win`,
`corsproxy.io`) proved too unreliable/rate-limited under repeat use. Instead, a topic
typed into the search box is saved as a "queued" topic in `localStorage`
(`osnews.queuedTopics`) and rendered by `renderQueuedTopicCard()`, which just shows a
copy-pasteable JSON snippet (`{ id, label, query }`) for the user to add to
`data/topics.json` by hand. There is intentionally no automatic path from the browser
back into the repo — that would require a write-capable GitHub credential living in
client-side storage, which was explicitly rejected in favor of a manual step.

## Gotchas

- The `headlines` topic in `data/topics.json` has `query: null`, which `feedUrlFor()`
  in `scripts/fetch-news.mjs` special-cases to Google's top-stories feed instead of a
  search query — don't assume every topic has a query string.
- The CI cron schedule is fixed UTC and does not adjust for US Central daylight saving;
  actual local fetch times drift by an hour twice a year (documented in README.md).
- `fetch-news.mjs` fetches topics sequentially (not `Promise.all`) intentionally, to stay
  gentle on Google News and keep CI logs readable in order — don't parallelize without
  reason to.
- Do not reintroduce client-side RSS fetching via a public CORS proxy for the search box
  — this was tried and removed for reliability reasons (see git history around the
  "queued topic" change).
