# OS News

A browser-based daily news dashboard. A GitHub Actions workflow fetches Google News RSS
for a set of topics twice a day and commits the results as `data/news.json`; the static
frontend (`index.html` / `style.css` / `app.js`) reads that file and renders it. No backend
server, no API keys.

## Topics

The default topic list lives in `data/topics.json`. It ships with:

- Headline News
- Climate Change
- US Politics
- The Iran War
- The Ukraine War
- US Midterm Elections
- Chicagoland Local News
- AI Tech Stories
- Quantum Prairie Events
- IL / Fox River Valley Events

Edit `data/topics.json` to change the built-in list — each entry is `{ id, label, query }`
(`query: null` pulls Google News top headlines instead of a search).

## Adding topics from the dashboard

Typing a topic into the search box adds it to **this browser only** (stored in
`localStorage`) and fetches it live via a public CORS proxy so you see results
immediately. Custom topics refresh automatically after 12 hours. They are **not**
added to `data/topics.json`, so the twice-daily background job won't pick them
up — if you want a topic covered permanently, add it to `data/topics.json`
directly.

**Known limitation:** the live fetch depends on free public CORS proxies
(`api.allorigins.win`, `corsproxy.io`), which are demo services with no
uptime guarantee — `app.js` tries each in turn and shows a clear
"couldn't load this topic" message if all of them are down at that moment.
This only affects instant results for custom search topics; the twice-daily
background job (`data/news.json`) doesn't use a proxy and isn't affected.

## Local development

```bash
npm install
npm run fetch-news   # populates data/news.json
npm run serve        # serves the dashboard at http://localhost:8080
```

Opening `index.html` directly via `file://` won't work — browsers block `fetch()`
of local JSON over the file protocol, so use `npm run serve` (or any static file server).

## Deployment

Push to GitHub and enable GitHub Pages (Settings → Pages → deploy from the `main`
branch root). The `fetch-news.yml` workflow runs on its own schedule (roughly 7am
and 6pm US Central, cron is UTC and doesn't shift for DST) and commits refreshed
`data/news.json`, which Pages then serves. You can also trigger a run manually from
the Actions tab (`workflow_dispatch`).
