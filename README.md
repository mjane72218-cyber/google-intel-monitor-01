# Google Intel Monitor

RSS-based news monitor with Focus / Window / Relevant-to filters, and
department-specific "why this matters" explanations generated per item —
powered by Google's Gemini API (free tier).

## How it works

- `public/index.html` — the frontend. Filters live in the URL params it sends
  to the function; no page reload, just a re-fetch.
- `netlify/functions/get-news.js` — pulls Google News RSS for the configured
  company, classifies each item's topic by keyword match, filters by date
  window, then asks Gemini for one relevance sentence per item for whichever
  department is selected.

## 1. Get a free Gemini API key

1. Go to **aistudio.google.com** and sign in with a Google account
2. Click **Get API key** (usually top-left or in a menu)
3. Click **Create API key**, choose or create a project
4. Copy the key — it's a long string, no fixed prefix like Anthropic's keys

No credit card is required for the free tier. Current free-tier limits are
generous for a project like this (roughly 1,500 requests/day on the Flash
model as of 2026) — plenty for personal or small-team use. Full details:
https://ai.google.dev/pricing

## 2. Deploy via GitHub + Netlify (no local install needed)

1. Create a new GitHub repository, upload every file in this folder into it
   (drag them all in via "uploading an existing file" on the repo's page,
   then Commit)
2. In Netlify: **Add new site → Import an existing project → GitHub** → pick
   the repo
3. Build settings: **Publish directory** = `public`, **Functions directory**
   = `netlify/functions` (both should auto-fill from `netlify.toml`)
   - If your repo has the project inside a subfolder (e.g. because you
     dragged in the whole outer folder instead of its contents), set
     **Base directory** to that folder name and prefix Publish/Functions
     directories with it too.
4. Before deploying, add an environment variable:
   **Site configuration → Environment variables → Add a variable**
   - Key: `GEMINI_API_KEY`
   - Value: the key from Step 1
5. Deploy. Every future push to the repo redeploys automatically.

## 3. Customize

- **Change the default company:** edit `company: "Google"` near the top of
  the `<script>` block in `public/index.html`, or just use the in-page
  "change company" panel at runtime.
- **Change what counts as each Focus topic:** edit `FOCUS_KEYWORDS` in
  `netlify/functions/get-news.js`.
- **Change the relevance-blurb prompt:** edit `deptContext` and the prompt
  text inside `generateBlurb()` in the same file.
- **Switch models:** `get-news.js` uses `gemini-2.5-flash` by default — fast
  and free-tier friendly. `gemini-2.5-pro` gives higher-quality text but has
  a much smaller free-tier daily quota.

## Known limitations of this build

- Focus classification is keyword-based, not AI-based — fast and free, but
  it will misclassify anything that doesn't use one of the listed words.
- No caching yet: changing any filter re-calls Gemini for every visible item.
  Fine for demo/internal use; worth adding caching before heavy team use.
- Google News RSS occasionally rate-limits aggressive polling from the same
  IP — fine for a team dashboard refreshed a few times a day, not for
  automated high-frequency polling.
- Free-tier Gemini usage may be used by Google to improve their models —
  worth knowing if you ever monitor anything beyond public news headlines.
