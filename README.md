# AI FOMO Radar

A daily, bilingual (Hebrew RTL / English) AI-news front page built for Uriel Mondrowicz:
6–10 stories from the last 24 hours (48 on thin days, labelled honestly), plus 1–3 things worth trying today.
It's a static site with no framework: one JSON file per issue goes in, plain HTML/CSS comes out.

Live: **https://urielmon.github.io/ai-fomo-radar/** · Archive: `/archive/` · Permanent issue pages: `/issues/YYYY-MM-DD/`

## Layout

```
issues/YYYY-MM-DD.json      one file per issue (the only thing you edit daily)
assets/img/YYYY-MM-DD/      photos downloaded from the articles (never hotlinked)
assets/css, assets/js       newspaper styles; language/theme toggles (saved in localStorage)
assets/fonts                self-hosted Newsreader (EN) + Frank Ruhl Libre (HE), woff2
schema/issue.schema.json    JSON Schema for an issue
scripts/build.mjs           validate + render everything into dist/
scripts/check-links.mjs     open every link in an issue and report status
scripts/add_image.py        download + resize an article photo into assets/img/<issue>/
scripts/deploy.sh           build and publish to GitHub Pages (one command)
scripts/screenshots.mjs     headless screenshots (mobile/desktop × light/dark)
```

## Producing tomorrow's issue

1. **Collect stories** from the last 24 h (if it's thin, e.g. on Shabbat, widen to 48 h and say so in `window.note`).
   Open every link and confirm it resolves, says what you claim, and is dated inside the window.
2. **Copy the newest JSON** to `issues/<tomorrow>.json`, then bump `issue_number`, `date`, `window` and replace the stories.
   Each story needs:
   - `headline.en` / `headline.he`: the Hebrew should read naturally, not as a literal translation
   - `why.en` / `why.he`: 1–2 sentences on why it matters *to Uriel*
   - `url`, `source`, `published` (ISO date or date-time with zone), `lead` (exactly one `true`)
   - optional `kicker`, `also` (extra links), `image` (or `null`)
   - wrap commands/settings in backticks (`` `claude update` ``) so they stay LTR inside Hebrew text
   - `try_today`: 1–3 items with `title`, `body`, `url`, `source`, `published`
3. **Photos** (real article images only: og:image or in-article; no AI art, no stock). Lead gets a big one, 3–4 others get small ones:
   ```bash
   python3 scripts/add_image.py "<og:image url>" 2026-10-11 some-slug --lead   # lead
   python3 scripts/add_image.py "<og:image url>" 2026-10-11 other-slug         # small
   ```
   Put the printed path in `image.src` and credit the outlet/photographer as stated in the article (`image.credit.en/he`).
4. **Check & build**
   ```bash
   npm run validate      # schema + window check; fails on missing source/date, stale dates, missing images
   npm run check-links   # opens every link (403 = bot-blocked news site, confirm in a browser)
   npm run build         # → dist/   (preview: npm run serve → http://localhost:8080)
   ```
5. **Deploy**
   ```bash
   npm run deploy        # = bash scripts/deploy.sh
   ```
   This builds, commits the source to `main`, force-pushes `dist/` to the `gh-pages` branch, and enables Pages if needed.
   The home page always shows the newest issue; older issues stay at `/issues/<date>/` and are listed in `/archive/`.

## Validation rules (build fails if any break)

- JSON matches `schema/issue.schema.json`: bilingual `en`/`he` text everywhere, `https://` URLs, non-empty `source`, valid `published`
- 6–10 stories, exactly one lead, 1–3 try-today items, unique ids, file name = `date`
- every story's `published` falls inside `window.start`–`window.end` (±12 h slack for late updates)
- every image file exists under `assets/img/<issue date>/`

## Design notes

Newspaper look: serif type, off-white paper / near-black ink (dark mode flips to dark paper / light ink), one accent colour
(newsprint red), rules and columns, masthead with Gregorian + Hebrew date and issue number. No gradients, no emoji, no rounded cards.
Mobile-first single column → 2 columns (tablet) → lead + sidebar with a 3-column story grid (desktop).
`?lang=he|en` and `?theme=dark|light` URL parameters set (and remember) the toggles.

## Requirements

Node ≥ 18 (build, no npm packages needed), Python 3 + Pillow (image helper), `gh` CLI logged in (deploy),
`npm i` + Google Chrome only for screenshots.
