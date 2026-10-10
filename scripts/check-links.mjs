#!/usr/bin/env node
// Opens every story / try-today / "also" link in an issue and reports HTTP status.
// Usage: node scripts/check-links.mjs [YYYY-MM-DD]   (default: newest issue)
// Exit 1 on 404/410/5xx/network errors. 401/403/429 are reported as "bot-blocked" (many news sites
// block scripted clients) — open those in a browser to confirm by hand.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = fs.readdirSync(path.join(ROOT, "issues")).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
const date = process.argv[2] || files.at(-1).replace(".json", "");
const issue = JSON.parse(fs.readFileSync(path.join(ROOT, "issues", `${date}.json`), "utf8"));
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
const links = [];
for (const s of [...issue.stories, ...issue.try_today]) {
  links.push([s.id, s.url]);
  for (const a of s.also || []) links.push([`${s.id} (also)`, a.url]);
}
let bad = 0;
for (const [id, url] of links) {
  let line;
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,*/*" }, redirect: "follow", signal: AbortSignal.timeout(20000) });
    const st = r.status;
    if (st >= 200 && st < 400) line = `ok   ${st}`;
    else if ([401, 403, 429].includes(st)) line = `warn ${st} bot-blocked, verify in a browser`;
    else { line = `FAIL ${st}`; bad++; }
  } catch (e) { line = `FAIL ${e.name}: ${e.message}`; bad++; }
  console.log(`${line.padEnd(44)} ${id}  ${url}`);
}
for (const s of issue.stories) if (s.image && !fs.existsSync(path.join(ROOT, s.image.src))) { console.log(`FAIL missing image ${s.image.src}`); bad++; }
console.log(bad ? `\n✗ ${bad} problem(s)` : `\n✓ all links resolve (check any 'warn' lines by hand)`);
process.exit(bad ? 1 : 0);
