// Headless screenshots: mobile + desktop, light + dark (and one Hebrew pair).
// Usage: node scripts/screenshots.mjs [baseUrl]   (default: the public site)
// Uses playwright-core with the system Chrome (CHROME_PATH or /usr/bin/google-chrome).
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = (process.argv[2] || "https://urielmon.github.io/ai-fomo-radar/").replace(/\/?$/, "/");
const out = path.join(ROOT, "screenshots");
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const shots = [
  { name: "mobile-light-en", vp: { width: 390, height: 844 }, mobile: true, lang: "en", theme: "light" },
  { name: "mobile-dark-en", vp: { width: 390, height: 844 }, mobile: true, lang: "en", theme: "dark" },
  { name: "desktop-light-en", vp: { width: 1440, height: 1000 }, mobile: false, lang: "en", theme: "light" },
  { name: "desktop-dark-en", vp: { width: 1440, height: 1000 }, mobile: false, lang: "en", theme: "dark" },
  { name: "mobile-light-he", vp: { width: 390, height: 844 }, mobile: true, lang: "he", theme: "light" },
  { name: "desktop-dark-he", vp: { width: 1440, height: 1000 }, mobile: false, lang: "he", theme: "dark" },
];
for (const s of shots) {
  const ctx = await browser.newContext({ viewport: s.vp, deviceScaleFactor: s.mobile ? 2 : 1, isMobile: s.mobile, hasTouch: s.mobile });
  const page = await ctx.newPage();
  await page.goto(`${base}?lang=${s.lang}&theme=${s.theme}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  // trigger lazy images for the full-page capture, then return to top
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } window.scrollTo(0, 0); });
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(out, `${s.name}.png`), fullPage: false });
  await page.screenshot({ path: path.join(out, `${s.name}-full.png`), fullPage: true });
  console.log("saved", `screenshots/${s.name}.png`, `(+ -full.png)`);
  await ctx.close();
}
await browser.close();
