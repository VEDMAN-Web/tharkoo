import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const base = process.env.BASE_URL || "http://127.0.0.1:4317";
const out = "/tmp/t91-shots";
mkdirSync(out, { recursive: true });

const paths = [
  ["home", "/"],
  ["cities", "/cities/"],
  ["dating", "/dating/"],
  ["city", "/dating/bengaluru/"],
  ["wellness", "/wellness/bengaluru/"],
  ["search", "/search/?q=a"],
  ["terms", "/terms/"],
  ["privacy", "/privacy/"],
  ["cookies", "/cookies/"],
  ["help", "/help/"],
  ["blog", "/blog/"],
  ["contact", "/contact/"],
  ["about", "/cms/about/"],
  ["scam", "/scam-report/"],
  ["report", "/submit-report/"],
  ["login", "/u/login/"],
  ["register", "/u/register/"],
  ["forgot", "/u/forgot/"],
  ["admin-login", "/admin/login/"],
  ["styleguide", "/styleguide/"],
  ["limited", "/429/"],
  ["missing", "/this-page-does-not-exist/"],
  ["dashboard", "/u/account/dashboard/"],
  ["ads", "/u/account/ads/"],
  ["credits", "/u/account/credits/"],
  ["history", "/u/account/credits/history/"],
  ["coupons", "/u/account/coupons/"],
  ["settings", "/u/account/edit-account/"],
  ["kyc", "/u/account/kyc/"],
  ["saved", "/u/account/saved/"],
  ["notes", "/u/account/notifications/"],
  ["post", "/u/post-insert/"],
];

function slug(name, width) {
  return `${out}/${name}-${width}.png`;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
await context.addInitScript(() => {
  localStorage.setItem("nl-age", "ok");
  localStorage.setItem("nl-cookies", "all");
});

for (const width of [1440, 390]) {
  for (const [name, path] of paths) {
    const page = await context.newPage();
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    await page.goto(base + path, { waitUntil: "domcontentloaded" }).catch(() => {});
    await page.screenshot({ path: slug(name, width), fullPage: true }).catch(() => {});
    await page.close();
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
}

const desk = await context.newPage();
await desk.setViewportSize({ width: 1440, height: 900 });
await desk.addInitScript(() => localStorage.removeItem("nl-age"));
const fresh = await browser.newContext();
const gate = await fresh.newPage();
await gate.setViewportSize({ width: 1440, height: 900 });
await gate.goto(base + "/", { waitUntil: "load" });
await gate.evaluate(() => localStorage.removeItem("nl-age"));
await gate.reload({ waitUntil: "load" });
await gate.screenshot({ path: slug("age-gate", 1440), fullPage: true });
await gate.close();
await fresh.close();

await desk.goto(base + "/", { waitUntil: "domcontentloaded" }).catch(() => {});
if (await desk.locator("[data-tk=hero-search]").count()) {
  await desk.locator("[data-tk=hero-search]").click();
  await desk.locator("[data-tk=search-modal]").waitFor({ timeout: 5000 }).catch(() => {});
  await desk.screenshot({ path: slug("search-modal", 1440), fullPage: false });
}
await desk.close();

const mob = await context.newPage();
await mob.setViewportSize({ width: 390, height: 844 });
await mob.goto(base + "/", { waitUntil: "domcontentloaded" }).catch(() => {});
if (await mob.locator("[data-tk=hero-search]").count()) {
  await mob.locator("[data-tk=hero-search]").click();
  await mob.locator("[data-tk=search-modal]").waitFor({ timeout: 5000 }).catch(() => {});
  await mob.screenshot({ path: slug("search-modal", 390), fullPage: false });
  await mob.keyboard.press("Escape");
  await mob.locator("[data-tk=menu-button]").click();
  await mob.locator("[data-tk=drawer]").waitFor({ timeout: 5000 }).catch(() => {});
  await mob.screenshot({ path: slug("drawer", 390), fullPage: false });
}
await mob.close();

console.log(`shots written to ${out}`);
await browser.close();
