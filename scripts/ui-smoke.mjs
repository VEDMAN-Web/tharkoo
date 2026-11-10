import { chromium } from "@playwright/test";

const base = process.env.BASE_URL || "http://127.0.0.1:4317";
const widths = [390, 1440];
const paths = ["/", "/cities/", "/dating/", "/dating/bengaluru/", "/search/?q=a", "/u/login/", "/u/register/", "/u/post-insert/", "/help/", "/cms/about/", "/styleguide/"];
const indexable = new Set(["/", "/cities/", "/dating/", "/dating/bengaluru/", "/help/", "/cms/about/"]);
const rows = [];
let failed = 0;

function record(path, width, ok, note) {
  rows.push({ path, width, ok, note });
  if (!ok) failed += 1;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  httpCredentials: process.env.BASIC_AUTH_USER
    ? { username: process.env.BASIC_AUTH_USER, password: process.env.BASIC_AUTH_PASS || "" }
    : undefined,
});

const titles = new Map();
let adPath = "";

for (const width of widths) {
  for (const path of paths) {
    const page = await context.newPage();
    const errors = [];
    const failedReqs = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && !msg.text().includes("_rsc")) errors.push(msg.text());
    });
    page.on("requestfailed", (req) => {
      const url = req.url();
      if (url.includes("_rsc") || req.failure()?.errorText === "net::ERR_ABORTED") return;
      failedReqs.push(`${req.failure()?.errorText || "failed"} ${url}`);
    });
    await page.setViewportSize({ width, height: 844 });
    const res = await page.goto(base + path, { waitUntil: "networkidle" });
    const status = res?.status() || 0;
    if (path === "/dating/bengaluru/" && !adPath) {
      adPath = await page.locator('a[href*="/ad/"]').first().getAttribute("href").catch(() => "");
    }
    const facts = await page.evaluate(() => {
      const h1 = document.querySelectorAll("h1").length;
      const family = getComputedStyle(document.body).fontFamily || "";
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href") || "";
      let tiny = 0;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const text = walker.currentNode.textContent || "";
        if (!text.trim()) continue;
        const el = walker.currentNode.parentElement;
        if (!el) continue;
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (size < 12) tiny += 1;
      }
      const broken = [...document.images].filter((img) => img.complete && img.naturalWidth === 0).length;
      return {
        h1,
        family,
        canonical,
        tiny,
        broken,
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        title: document.title,
      };
    });
    const notes = [];
    if (status !== 200) notes.push(`status ${status}`);
    if (errors.length) notes.push(`console ${errors[0]}`);
    if (failedReqs.length) notes.push(`request ${failedReqs[0]}`);
    if (facts.broken) notes.push("broken image");
    if (width === 390 && facts.overflow) notes.push("overflow");
    if (facts.h1 !== 1) notes.push(`h1 ${facts.h1}`);
    if (!/Manrope/i.test(facts.family)) notes.push(`font ${facts.family}`);
    if (facts.tiny) notes.push(`tiny ${facts.tiny}`);
    if (indexable.has(path) && !facts.canonical) notes.push("canonical");
    const seen = titles.get(facts.title);
    if (seen && seen !== path) notes.push(`title shared with ${seen}`);
    else titles.set(facts.title, path);
    record(path, width, notes.length === 0, notes.join("; ") || "ok");
    if (width === 1440 && path === "/") {
      await page.screenshot({ path: "/tmp/t81-home-1440.png", fullPage: true });
    }
    if (width === 390 && path === "/") {
      await page.screenshot({ path: "/tmp/t81-home-390.png", fullPage: true });
    }
    await page.close();
  }
}

if (adPath) {
  for (const width of widths) {
    const page = await context.newPage();
    const errors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.setViewportSize({ width, height: 844 });
    const res = await page.goto(new URL(adPath, base).toString(), { waitUntil: "networkidle" });
    const h1 = await page.locator("h1").count();
    const ok = res?.status() === 200 && h1 === 1 && errors.length === 0;
    record(adPath, width, ok, ok ? "ok" : `status ${res?.status()} h1 ${h1}`);
    if (width === 390) await page.screenshot({ path: "/tmp/t81-ad-390.png", fullPage: true });
    if (width === 1440) await page.screenshot({ path: "/tmp/t81-ad-1440.png", fullPage: true });
    await page.close();
  }
}

const clickPage = await context.newPage();
const clickErrors = [];
clickPage.on("console", (msg) => {
  if (msg.type() === "error") clickErrors.push(msg.text());
});
await clickPage.setViewportSize({ width: 1440, height: 900 });
await clickPage.goto(base + "/", { waitUntil: "networkidle" });
const targets = clickPage.locator("header a, header button, main form button, article a");
const count = Math.min(await targets.count(), 12);
for (let i = 0; i < count; i++) {
  const el = targets.nth(i);
  if (!(await el.isVisible().catch(() => false))) continue;
  await el.click({ timeout: 3000 }).catch(() => {});
  await clickPage.waitForTimeout(200);
}
record("click-through", 1440, clickErrors.length === 0, clickErrors[0] || "ok");
await clickPage.close();

await browser.close();
console.log("path\twidth\tok\tnote");
for (const row of rows) console.log(`${row.path}\t${row.width}\t${row.ok ? "pass" : "fail"}\t${row.note}`);
console.log(`smoke ${failed === 0 ? "pass" : "fail"} ${rows.length - failed}/${rows.length}`);
process.exit(failed === 0 ? 0 : 1);
