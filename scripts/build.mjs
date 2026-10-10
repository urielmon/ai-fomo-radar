#!/usr/bin/env node
// AI FOMO Radar — static site builder. No dependencies (Node >= 18).
// Reads issues/*.json, validates them (schema + window/date/image checks), renders dist/.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const TZ = "Asia/Jerusalem";
const SITE_URL = (process.env.SITE_URL || "https://urielmon.github.io/ai-fomo-radar/").replace(/\/?$/, "/");

// ---------- tiny JSON-schema validator (subset used by schema/issue.schema.json) ----------
function typeOf(v) { return v === null ? "null" : Array.isArray(v) ? "array" : Number.isInteger(v) ? "integer" : typeof v; }
function validate(schema, value, at, root, errors) {
  if (schema.$ref) schema = schema.$ref.split("/").slice(1).reduce((o, k) => o[k], root);
  if (schema.type) {
    const types = [].concat(schema.type), t = typeOf(value);
    if (!types.includes(t) && !(t === "integer" && types.includes("number"))) { errors.push(`${at}: expected ${types.join("|")}, got ${t}`); return; }
  }
  if (value === null) return;
  if (typeof value === "string") {
    if (schema.minLength && value.trim().length < schema.minLength) errors.push(`${at}: must not be empty`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${at}: "${value}" does not match ${schema.pattern}`);
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${at}: < ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${at}: > ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${at}: needs at least ${schema.minItems} items (has ${value.length})`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${at}: at most ${schema.maxItems} items (has ${value.length})`);
    if (schema.items) value.forEach((v, i) => validate(schema.items, v, `${at}[${i}]`, root, errors));
  }
  if (typeOf(value) === "object") {
    for (const k of schema.required || []) if (!(k in value) || value[k] === undefined) errors.push(`${at}: missing required "${k}"`);
    for (const [k, s] of Object.entries(schema.properties || {})) if (k in value) validate(s, value[k], `${at}.${k}`, root, errors);
    if (schema.additionalProperties === false) for (const k of Object.keys(value)) if (!(schema.properties || {})[k]) errors.push(`${at}: unexpected property "${k}"`);
  }
}

function parsePublished(s) {
  // Date-only values are treated as that calendar day in Israel time (whole day).
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { start: new Date(`${s}T00:00:00+03:00`), end: new Date(`${s}T23:59:59+03:00`), dateOnly: true };
  const d = new Date(s); return { start: d, end: d, dateOnly: false };
}

function checkIssue(issue, file, schema) {
  const errors = [];
  validate(schema, issue, path.basename(file), schema, errors);
  if (errors.length) return errors;
  if (path.basename(file) !== `${issue.date}.json`) errors.push(`${file}: file name must be ${issue.date}.json`);
  const leads = issue.stories.filter(s => s.lead);
  if (leads.length !== 1) errors.push(`${issue.date}: exactly one story must have lead: true (found ${leads.length})`);
  const ws = new Date(issue.window.start), we = new Date(issue.window.end);
  if (isNaN(ws) || isNaN(we) || we <= ws) errors.push(`${issue.date}: window.start/end invalid`);
  const slack = 12 * 3600e3; // tolerance for late updates / timezone ambiguity
  const ids = new Set();
  for (const [kind, list] of [["stories", issue.stories], ["try_today", issue.try_today]]) {
    list.forEach((it, i) => {
      const where = `${issue.date} ${kind}[${i}] (${it.id})`;
      if (ids.has(it.id)) errors.push(`${where}: duplicate id`); ids.add(it.id);
      if (!it.source || !it.source.trim()) errors.push(`${where}: missing source`);
      const p = parsePublished(it.published || "");
      if (isNaN(p.start)) { errors.push(`${where}: missing/invalid published date`); return; }
      if (kind === "stories" && (p.end < new Date(ws - slack) || p.start > new Date(+we + slack)))
        errors.push(`${where}: published ${it.published} is outside the issue window ${issue.window.start} → ${issue.window.end}`);
      if (it.image) {
        const f = path.join(ROOT, it.image.src);
        if (!fs.existsSync(f)) errors.push(`${where}: image file not found: ${it.image.src}`);
        if (!it.image.src.includes(`/${issue.date}/`)) errors.push(`${where}: image must live in assets/img/${issue.date}/`);
      }
    });
  }
  return errors;
}

// ---------- helpers ----------
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Inline markup: `code` becomes an isolated LTR <code> span (keeps commands readable inside Hebrew RTL text).
const rich = s => esc(s).replace(/`([^`]+)`/g, '<bdi dir="ltr"><code>$1</code></bdi>');
const bi = (o, tag = "span") => `<${tag} class="l-en" lang="en">${rich(o.en)}</${tag}><${tag} class="l-he" lang="he" dir="rtl">${rich(o.he)}</${tag}>`;
const T = (en, he) => ({ en, he });

function gematria(n) {
  const map = [[400,"ת"],[300,"ש"],[200,"ר"],[100,"ק"],[90,"צ"],[80,"פ"],[70,"ע"],[60,"ס"],[50,"נ"],[40,"מ"],[30,"ל"],[20,"כ"],[10,"י"],[9,"ט"],[8,"ח"],[7,"ז"],[6,"ו"],[5,"ה"],[4,"ד"],[3,"ג"],[2,"ב"],[1,"א"]];
  let out = ""; n = n % 1000;
  while (n > 0) {
    if (n === 15) { out += "טו"; break; } if (n === 16) { out += "טז"; break; }
    for (const [v, c] of map) if (n >= v) { out += c; n -= v; break; }
  }
  return out.length === 1 ? out + "׳" : out.slice(0, -1) + "״" + out.slice(-1);
}
function hebrewCalendarDate(d) {
  const parts = new Intl.DateTimeFormat("he-IL-u-ca-hebrew", { day: "numeric", month: "long", year: "numeric", timeZone: TZ }).formatToParts(d);
  const day = +parts.find(p => p.type === "day").value, month = parts.find(p => p.type === "month").value, year = +parts.find(p => p.type === "year").value;
  return `${gematria(day)} ${month.startsWith("ב") ? month : "ב" + month} ${gematria(year)}`;
}
function fmtLong(dateStr) {
  const d = new Date(`${dateStr}T12:00:00+03:00`);
  return {
    en: new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ }).format(d),
    he: new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ }).format(d),
    hebcal: hebrewCalendarDate(d),
  };
}
function fmtPublished(s) {
  const p = parsePublished(s);
  if (p.dateOnly) {
    const d = new Date(`${s}T12:00:00+03:00`);
    return T(new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TZ }).format(d),
             new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short", year: "numeric", timeZone: TZ }).format(d));
  }
  const o = { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TZ };
  return T(new Intl.DateTimeFormat("en-GB", o).format(p.start) + " (Israel)", new Intl.DateTimeFormat("he-IL", o).format(p.start) + " (שעון ישראל)");
}
function isoAttr(s) { const p = parsePublished(s); return p.dateOnly ? s : p.start.toISOString(); }

function jpegSize(file) {
  const b = fs.readFileSync(file);
  if (b[0] === 0x89 && b[1] === 0x50) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; // PNG
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}

// ---------- templates ----------
const HEAD_SCRIPT = `(function(){try{var d=document.documentElement,q=new URLSearchParams(location.search),l=q.get('lang'),t=q.get('theme');if(l==='he'||l==='en'){localStorage.setItem('fomo-lang',l)}else{l=localStorage.getItem('fomo-lang')}if(t==='dark'||t==='light'){localStorage.setItem('fomo-theme',t)}else{t=localStorage.getItem('fomo-theme')}if(!l){l=(navigator.language||'').toLowerCase().indexOf('he')===0?'he':'en'}if(!t){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}d.setAttribute('data-lang',l);d.setAttribute('lang',l);d.setAttribute('dir',l==='he'?'rtl':'ltr');d.setAttribute('data-theme',t)}catch(e){}})();`;

function layout({ title, description, rel, body, canonical, ogImage }) {
  return `<!doctype html>
<html lang="en" dir="ltr" data-lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#f5f0e6" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#14120f" media="(prefers-color-scheme: dark)">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ""}
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : ""}
<script>${HEAD_SCRIPT}</script>
<link rel="preload" href="${rel}assets/fonts/Newsreader-latin-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${rel}assets/fonts/FrankRuhlLibre-hebrew-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${rel}assets/css/fonts.css">
<link rel="stylesheet" href="${rel}assets/css/site.css">
<link rel="icon" href="${rel}assets/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/feed+json" title="AI FOMO Radar" href="${rel}feed.json">
</head>
<body>
<a class="skip" href="#main">${bi(T("Skip to content", "דלג לתוכן"))}</a>
${body}
<script src="${rel}assets/js/site.js" defer></script>
</body>
</html>
`;
}

function controls() {
  return `<div class="controls" role="group" aria-label="Display settings">
  <button type="button" class="ctl" id="lang-toggle" aria-label="Switch language / החלף שפה"><span class="l-en" lang="he">עברית</span><span class="l-he" lang="en">English</span></button>
  <button type="button" class="ctl" id="theme-toggle" aria-pressed="false"><span class="theme-dark-label">${bi(T("Light", "בהיר"))}</span><span class="theme-light-label">${bi(T("Dark", "כהה"))}</span></button>
</div>`;
}

function masthead(issue, rel, { small = false } = {}) {
  const d = issue ? fmtLong(issue.date) : null;
  return `<header class="masthead${small ? " masthead--small" : ""}">
  <div class="masthead__bar">
    <span class="masthead__place">${bi(T("Kfar Saba edition", "מהדורת כפר סבא"))}</span>
    ${controls()}
  </div>
  <div class="masthead__title"><a href="${rel}index.html" aria-label="AI FOMO Radar — home">AI FOMO Radar</a></div>
  <p class="masthead__tagline">${bi(T("The AI news you shouldn't miss, every morning", "חדשות ה-AI שאסור לפספס, כל בוקר"))}</p>
  ${d ? `<div class="masthead__dateline">
    <span>${bi(T(d.en, d.he))}<span class="l-he" lang="he" dir="rtl"> · ${esc(d.hebcal)}</span></span>
    <span>${bi(T(`Vol. 1 · No. ${issue.issue_number}`, `כרך א׳ · גיליון ${issue.issue_number}`))}</span>
  </div>` : ""}
  <nav class="masthead__nav" aria-label="Site">
    <a href="${rel}index.html">${bi(T("Today", "היום"))}</a>
    <a href="${rel}archive/index.html">${bi(T("Archive", "ארכיון"))}</a>
  </nav>
</header>`;
}

function figure(img, rel, lead) {
  if (!img) return "";
  const size = jpegSize(path.join(ROOT, img.src)) || {};
  return `<figure class="fig${lead ? " fig--lead" : ""}">
  <img src="${rel}${esc(img.src)}" ${size.w ? `width="${size.w}" height="${size.h}"` : ""} alt="${esc(img.alt.en)}" data-alt-he="${esc(img.alt.he)}" ${lead ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
  <figcaption>${bi(img.credit)}</figcaption>
</figure>`;
}

function meta(it) {
  const p = fmtPublished(it.published);
  const also = (it.also || []).map(a => ` · <a href="${esc(a.url)}" rel="noopener">${bi(a.label)}</a>`).join("");
  return `<p class="meta"><a class="src" href="${esc(it.url)}" rel="noopener">${esc(it.source)}</a> · <time datetime="${isoAttr(it.published)}">${bi(p)}</time>${also}</p>`;
}

function story(s, rel) {
  const lead = s.lead;
  const H = lead ? "h2" : "h3";
  return `<article class="story${lead ? " story--lead" : ""}${s.image ? " has-img" : ""}" id="${esc(s.id)}">
  ${lead ? figure(s.image, rel, true) : ""}
  ${s.kicker ? `<p class="kicker">${bi(s.kicker)}</p>` : ""}
  <${H} class="headline"><a href="${esc(s.url)}" rel="noopener">${bi(s.headline)}</a></${H}>
  ${!lead ? figure(s.image, rel, false) : ""}
  <p class="why"><strong class="why__label">${bi(T("Why it matters to you:", "למה זה חשוב לך:"))}</strong> ${bi(s.why)}</p>
  ${meta(s)}
</article>`;
}

function tryBox(issue) {
  return `<aside class="try" aria-labelledby="try-h">
  <h2 class="section-h" id="try-h">${bi(T("Worth trying today", "שווה לנסות היום"))}</h2>
  <ol class="try__list">
  ${issue.try_today.map(t => `<li class="try__item">
    <h3 class="try__title">${bi(t.title)}</h3>
    <p>${bi(t.body)}</p>
    ${meta(t)}
  </li>`).join("\n  ")}
  </ol>
</aside>`;
}

function issueNav(issue, all, rel) {
  const i = all.findIndex(x => x.date === issue.date);
  const newer = all[i - 1], older = all[i + 1];
  if (!newer && !older) return "";
  return `<nav class="issue-nav" aria-label="Issues">
  ${older ? `<a rel="prev" href="${rel}issues/${older.date}/index.html">${bi(T(`← Previous issue (${older.date})`, `→ הגיליון הקודם (${older.date})`))}</a>` : "<span></span>"}
  ${newer ? `<a rel="next" href="${rel}issues/${newer.date}/index.html">${bi(T(`Next issue (${newer.date}) →`, `הגיליון הבא (${newer.date}) ←`))}</a>` : "<span></span>"}
</nav>`;
}

function footer(issue, rel) {
  return `<footer class="footer">
  <p>${bi(T("Every link in this issue was opened and checked before publishing. Dates and times are Israel time. Photos come from the linked articles and are credited to their owners.",
           "כל קישור בגיליון נפתח ונבדק לפני הפרסום. התאריכים והשעות לפי שעון ישראל. התמונות לקוחות מהכתבות המקושרות, והקרדיט שמור לבעליהן."))}</p>
  <p>${bi(T("Made for Uriel Mondrowicz · Kfar Saba", "נערך עבור אוריאל מונדרוביץ׳ · כפר סבא"))} · <a href="${rel}archive/index.html">${bi(T("All issues", "כל הגיליונות"))}</a></p>
</footer>`;
}

function issuePage(issue, all, rel, canonical) {
  const lead = issue.stories.find(s => s.lead);
  const rest = issue.stories.filter(s => !s.lead);
  const body = `${masthead(issue, rel)}
<main id="main" class="page">
  <p class="window-note"><span class="window-note__label">${bi(T(`Window: last ${issue.window.hours} hours`, `חלון: ${issue.window.hours} השעות האחרונות`))}</span> ${bi(issue.window.note)}</p>
  <section class="front" aria-label="Lead story">
    ${story(lead, rel)}
    ${tryBox(issue)}
  </section>
  <section class="stories" aria-labelledby="more-h">
    <h2 class="section-h" id="more-h">${bi(T("Also on the radar", "עוד על הרדאר"))}</h2>
    <div class="cols">
    ${rest.map(s => story(s, rel)).join("\n    ")}
    </div>
  </section>
  ${issueNav(issue, all, rel)}
</main>
${footer(issue, rel)}`;
  return layout({
    title: `AI FOMO Radar · ${issue.date} · No. ${issue.issue_number}`,
    description: lead.headline.en,
    rel, body, canonical,
    ogImage: lead.image ? SITE_URL + lead.image.src : null,
  });
}

function archivePage(all, rel) {
  const rows = all.map(is => {
    const d = fmtLong(is.date), lead = is.stories.find(s => s.lead);
    return `<li class="arch__item">
    <a class="arch__link" href="${rel}issues/${is.date}/index.html">
      <span class="arch__date">${bi(T(d.en, d.he))}</span>
      <span class="arch__no">${bi(T(`No. ${is.issue_number}`, `גיליון ${is.issue_number}`))}</span>
      <span class="arch__lead">${bi(lead.headline)}</span>
      <span class="arch__count">${bi(T(`${is.stories.length} stories · ${is.try_today.length} to try`, `${is.stories.length} כתבות · ${is.try_today.length} לנסות`))}</span>
    </a>
  </li>`;
  }).join("\n  ");
  const body = `${masthead(null, rel, { small: true })}
<main id="main" class="page">
  <h1 class="section-h section-h--page">${bi(T("Archive: every issue", "ארכיון: כל הגיליונות"))}</h1>
  <ol class="arch">
  ${rows}
  </ol>
</main>
${footer(null, rel)}`;
  return layout({ title: "AI FOMO Radar · Archive", description: "All past issues of AI FOMO Radar", rel, body, canonical: SITE_URL + "archive/" });
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    e.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

// ---------- main ----------
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, "schema/issue.schema.json"), "utf8"));
const files = fs.readdirSync(path.join(ROOT, "issues")).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse();
if (!files.length) { console.error("No issues/*.json found"); process.exit(1); }
let allErrors = [];
const issues = files.map(f => {
  const file = path.join(ROOT, "issues", f);
  let data;
  try { data = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { allErrors.push(`${f}: invalid JSON: ${e.message}`); return null; }
  allErrors.push(...checkIssue(data, file, schema));
  return data;
});
const nums = issues.filter(Boolean).map(i => i.issue_number);
if (new Set(nums).size !== nums.length) allErrors.push("issue_number values must be unique");
if (allErrors.length) {
  console.error(`\n✗ Validation failed (${allErrors.length} error${allErrors.length > 1 ? "s" : ""}):`);
  for (const e of allErrors) console.error("  - " + e);
  process.exit(1);
}
if (process.argv.includes("--validate-only")) { console.log(`✓ ${issues.length} issue(s) valid`); process.exit(0); }

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
copyDir(path.join(ROOT, "assets"), path.join(DIST, "assets"));
fs.writeFileSync(path.join(DIST, ".nojekyll"), "");

const latest = issues[0];
fs.writeFileSync(path.join(DIST, "index.html"), issuePage(latest, issues, "", SITE_URL + `issues/${latest.date}/`));
for (const is of issues) {
  const dir = path.join(DIST, "issues", is.date);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), issuePage(is, issues, "../../", SITE_URL + `issues/${is.date}/`));
  fs.copyFileSync(path.join(ROOT, "issues", `${is.date}.json`), path.join(dir, "issue.json"));
}
fs.mkdirSync(path.join(DIST, "archive"), { recursive: true });
fs.writeFileSync(path.join(DIST, "archive", "index.html"), archivePage(issues, "../"));
fs.writeFileSync(path.join(DIST, "404.html"), layout({ title: "AI FOMO Radar · Not found", description: "Not found", rel: SITE_URL, body: `${masthead(null, SITE_URL, { small: true })}<main id="main" class="page"><h1 class="section-h section-h--page">${bi(T("Page not found", "הדף לא נמצא"))}</h1><p><a href="${SITE_URL}">${bi(T("Go to today's issue", "לגיליון של היום"))}</a></p></main>` }));
// JSON Feed (latest 20 issues)
fs.writeFileSync(path.join(DIST, "feed.json"), JSON.stringify({
  version: "https://jsonfeed.org/version/1.1", title: "AI FOMO Radar", home_page_url: SITE_URL, feed_url: SITE_URL + "feed.json",
  items: issues.slice(0, 20).map(is => ({ id: SITE_URL + `issues/${is.date}/`, url: SITE_URL + `issues/${is.date}/`, title: `No. ${is.issue_number} · ${is.stories.find(s => s.lead).headline.en}`, date_published: is.generated_at || `${is.date}T08:00:00+03:00`, content_text: is.stories.map(s => `• ${s.headline.en} (${s.source})`).join("\n") })),
}, null, 2));
console.log(`✓ Built ${issues.length} issue(s) → dist/ (latest: ${latest.date}, No. ${latest.issue_number})`);
