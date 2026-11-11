import { chromium } from "@playwright/test";

const base = process.env.BASE_URL || "http://127.0.0.1:4317";
const widths = [
  [1440, 900],
  [768, 1024],
  [390, 844],
];
const publicPaths = [
  "/",
  "/cities/",
  "/dating/",
  "/dating/bengaluru/",
  "/wellness/bengaluru/",
  "/search/?q=a",
  "/terms/",
  "/privacy/",
  "/cookies/",
  "/help/",
  "/blog/",
  "/contact/",
  "/cms/about/",
  "/scam-report/",
  "/submit-report/",
  "/u/login/",
  "/u/register/",
  "/u/forgot/",
  "/admin/login/",
  "/styleguide/",
  "/429/",
  "/this-page-does-not-exist/",
];
const signedPaths = [
  "/u/account/dashboard/",
  "/u/account/ads/",
  "/u/account/credits/",
  "/u/account/credits/history/",
  "/u/account/coupons/",
  "/u/account/edit-account/",
  "/u/account/kyc/",
  "/u/account/saved/",
  "/u/account/notifications/",
  "/u/post-insert/",
];

const rows = [];
let failed = 0;
const titles = new Map();

function record(path, width, ok, note) {
  rows.push({ path, width, ok, note });
  console.log(`${ok ? "PASS" : "FAIL"} ${width} ${path} ${note || ""}`);
  if (!ok) failed += 1;
}

function lum(rgb) {
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return 1;
  const lin = (c) => {
    const x = Number(c) / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(m[1]) + 0.7152 * lin(m[2]) + 0.0722 * lin(m[3]);
}

async function inspect(page) {
  return page.evaluate(() => {
    function lum(rgb) {
      const m = String(rgb).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (!m) return 1;
      if (m[4] !== undefined && Number(m[4]) === 0) return 1;
      const lin = (c) => {
        const x = Number(c) / 255;
        return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * lin(m[1]) + 0.7152 * lin(m[2]) + 0.0722 * lin(m[3]);
    }
    const family = getComputedStyle(document.body).fontFamily || "";
    const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href") || "";
    const robots = document.querySelector('meta[name="robots"]')?.getAttribute("content") || "";
    let tiny = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent || "";
      if (!text.trim()) continue;
      const el = walker.currentNode.parentElement;
      if (!el || el.closest("script,style")) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size > 0 && size < 12) tiny += 1;
    }
    const broken = [...document.images].filter((img) => img.complete && img.naturalWidth === 0 && img.getAttribute("alt") !== "").map((img) => img.currentSrc || img.src);
    const dark = [];
    const sel = "body, header, footer, main, section, article, dialog, [role=dialog], [data-tk=drawer], [data-tk=search-modal], [data-tk=gallery]";
    for (const el of document.querySelectorAll(sel)) {
      if (el.closest("[data-tk=hero], [data-tk=security-tips], [data-tk=promo-band], [data-tk=cities-banner], .tk-banner, button, a.tk-btn")) continue;
      if (el.matches("[data-tk=hero], [data-tk=security-tips], [data-tk=promo-band], [data-tk=cities-banner], .tk-banner")) continue;
      const bg = getComputedStyle(el).backgroundColor;
      if (lum(bg) < 0.8) dark.push(`${el.tagName}.${el.className} ${bg}`.slice(0, 120));
    }
    return {
      h1: document.querySelectorAll("h1").length,
      family,
      canonical,
      robots,
      tiny,
      broken,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      title: document.title,
      scheme: getComputedStyle(document.documentElement).colorScheme,
      bodyLum: lum(getComputedStyle(document.body).backgroundColor),
      dark: dark.slice(0, 3),
      phone: /\b[6-9]\d{9}\b/.test(document.body.innerText),
      icons: [...document.querySelectorAll("svg.lucide")].flatMap((el) => {
        if (el.closest(".tk-icon-lg, .tk-banner-pins")) return [];
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return [];
        const box = el.getBoundingClientRect();
        if (box.width < 1 || box.height < 1) return [];
        const ratio = box.width / box.height;
        if (Math.abs(ratio - 1) > 0.1 || box.width > 32) return [`${Math.round(box.width)}x${Math.round(box.height)}`];
        return [];
      }).slice(0, 3),
    };
  });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  httpCredentials: process.env.BASIC_AUTH_USER
    ? { username: process.env.BASIC_AUTH_USER, password: process.env.BASIC_AUTH_PASS || "" }
    : undefined,
});
await context.addInitScript(() => {
  localStorage.setItem("nl-age", "ok");
  localStorage.setItem("nl-cookies", "all");
});

const badStatus = [];
context.on("response", (res) => {
  const url = res.url();
  if (url.includes("_rsc") || url.includes("favicon")) return;
  if (res.status() >= 400 && !url.includes("this-page-does-not-exist")) {
    const where = res.frame()?.url() || "";
    badStatus.push(`${res.status()} ${url} @ ${where}`);
  }
});

let districtPath = "";
let adPath = "";

async function visit(path, width, height, expectStatus = 200) {
  const page = await context.newPage();
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && !/Failed to load resource/i.test(msg.text())) errors.push(msg.text().slice(0, 180));
  });
  page.on("pageerror", (err) => errors.push(String(err).slice(0, 180)));
  await page.setViewportSize({ width, height });
  const res = await page.goto(base + path, { waitUntil: "domcontentloaded" });
  await page.locator("h1").first().waitFor({ timeout: 8000 }).catch(() => {});
  await page.waitForFunction(() => {
    const title = document.title || "";
    return title.length > 0 && !title.startsWith("Tharkoo, premium classifieds");
  }, { timeout: 4000 }).catch(() => {});
  const status = res?.status() || 0;
  const facts = await inspect(page);
  const notes = [];
  if (status !== expectStatus) notes.push(`status ${status}`);
  if (errors.length) notes.push(`console ${errors[0]}`);
  if (facts.broken.length) notes.push(`broken ${facts.broken[0]}`);
  if (width <= 768 && facts.overflow) notes.push("overflow");
  if (path === "/" && !/noindex/i.test(facts.robots)) notes.push("robots");
  if (facts.h1 !== 1) notes.push(`h1 ${facts.h1}`);
  if (!/Manrope/i.test(facts.family)) notes.push(`font ${facts.family}`);
  if (facts.tiny) notes.push(`tiny ${facts.tiny}`);
  if (!/noindex/i.test(facts.robots) && !facts.canonical && expectStatus === 200) notes.push("canonical");
  if (facts.scheme !== "light") notes.push(`scheme ${facts.scheme}`);
  if (facts.bodyLum < 0.9) notes.push(`body ${facts.bodyLum.toFixed(2)}`);
  if (facts.dark.length) notes.push(`dark ${facts.dark[0]}`);
  if (facts.icons?.length) notes.push(`icons ${facts.icons[0]}`);
  if ((path.includes("/bengaluru/") || path.startsWith("/ad/")) && facts.phone) notes.push("phone in html");
  const seen = titles.get(facts.title);
  if (!path.includes("does-not-exist")) {
    if (seen && seen !== path && facts.title) notes.push(`title shared with ${seen}`);
    else if (facts.title) titles.set(facts.title, path);
  }
  record(path, width, notes.length === 0, notes.join("; "));
  return { page, facts, status };
}

const ageContext = await browser.newContext();
const age = await ageContext.newPage();
await age.setViewportSize({ width: 1440, height: 900 });
await age.goto(base + "/", { waitUntil: "load" });
await age.evaluate(() => localStorage.removeItem("nl-age"));
await age.reload({ waitUntil: "load" });
const ageText = await age.locator("[data-tk=age-gate]").innerText().catch(() => "");
const ageOk = /ACCEPT/i.test(ageText) && /Decline/i.test(ageText);
if (ageOk) {
  await age.locator("[data-tk=age-accept]").click();
  await age.waitForTimeout(200);
  const hidden = await age.locator("[data-tk=age-gate]").count();
  await age.reload({ waitUntil: "load" });
  const still = await age.locator("[data-tk=age-gate]").count();
  record("/ age-gate", 1440, hidden === 0 && still === 0, hidden || still ? "gate stayed" : "");
} else record("/ age-gate", 1440, false, "missing ACCEPT");
await age.close();
await ageContext.close();

for (const [width, height] of widths) {
  for (const path of publicPaths) {
    const expectStatus = path.includes("does-not-exist") ? 404 : 200;
    const { page } = await visit(path, width, height, expectStatus);
    if (path === "/dating/bengaluru/" && !districtPath) {
      districtPath =
        (await page.locator("a[href]").evaluateAll((els) => {
          const href = els.map((el) => el.getAttribute("href") || "").find((value) => /^\/dating\/bengaluru\/[^/?]+\/?$/.test(value));
          return href || "";
        })) || "";
      adPath = (await page.locator('a[href*="/ad/"]').first().getAttribute("href").catch(() => "")) || "";
    }
    if (path === "/" && width === 1440) {
      const extra = [];
      const hero = await page.locator("[data-tk=hero]").boundingBox();
      const expected = Math.min(880, Math.max(425, 0.7 * height));
      if (!hero || Math.abs(hero.height - expected) > expected * 0.05) extra.push(`hero ${hero?.height}`);
      const search = await page.locator("[data-tk=hero-search]").innerText();
      if (!search.includes("Search By City, Category...")) extra.push("search label");
      await page.locator("[data-tk=home-card]").first().waitFor({ timeout: 25000 }).catch(() => {});
      if ((await page.locator("[data-tk=home-card]").count()) !== 5) extra.push(`cards ${await page.locator("[data-tk=home-card]").count()}`);
      const post = page.locator("[data-tk=header] [data-tk=post-ad]");
      if ((await post.innerText()) !== "POST YOUR AD") extra.push("post");
      const pos = await page.locator("[data-tk=header]").evaluate((el) => getComputedStyle(el).position);
      if (pos === "sticky" || pos === "fixed") extra.push("sticky");
      const box = await page.locator(".tk-container").first().boundingBox();
      if (!box || Math.abs(box.width - 960) > 2) extra.push(`container ${box?.width}`);
      const h2 = await page.locator("h2").first().innerText();
      if (!/Latest listings in your city/i.test(h2)) extra.push("h2");
      const foot = await page.locator("[data-tk=footer]").innerText();
      for (const word of ["Legal", "Support", "Security", "Company", "Boost your visibility", "Countries"]) {
        if (!foot.includes(word)) extra.push(`footer ${word}`);
      }
      await page.evaluate(() => window.scrollTo(0, 700));
      await page.waitForTimeout(200);
      if ((await page.locator("[data-tk=back-to-top]").count()) < 1) extra.push("back to top");
      record("/ home-structure", width, extra.length === 0, extra.join("; "));
    }
    if (path === "/" && width === 390) {
      const extra = [];
      const hero = await page.locator("[data-tk=hero]").boundingBox();
      if (!hero || Math.abs(hero.height - 290) > 5) extra.push(`hero ${hero?.height}`);
      const homePost = page.locator("a.tk-home-post");
      if (!(await homePost.isVisible())) extra.push("home post");
      await page.locator("[data-tk=menu-button]").click();
      const drawer = page.locator("[data-tk=drawer]");
      await drawer.waitFor({ state: "visible" });
      const dbox = await drawer.boundingBox();
      if (!dbox || Math.abs(dbox.width - 277) > 6) extra.push(`drawer ${dbox?.width}`);
      const text = await drawer.innerText();
      for (const word of ["Publish ad", "POST YOUR AD", "Services for you!", "Help Center"]) {
        if (!text.includes(word)) extra.push(word);
      }
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
      if (await drawer.isVisible()) extra.push("esc");
      record("/ home-mobile", width, extra.length === 0, extra.join("; "));
    }
    await page.close();
  }
}

if (districtPath) {
  for (const [width, height] of widths) {
    const { page } = await visit(districtPath, width, height);
    await page.close();
  }
}

for (const [width, height] of widths) {
  const page = await context.newPage();
  await page.setViewportSize({ width, height });
  await page.goto(base + "/", { waitUntil: "load" });
  await page.locator("[data-tk=hero-search]").click();
  const modal = page.locator("[data-tk=search-modal]");
  await modal.waitFor({ state: "visible" });
  const box = await modal.boundingBox();
  const text = await modal.innerText();
  const notes = [];
  const want = width === 1440 ? 800 : width;
  if (!box || Math.abs(box.width - want) > 8) notes.push(`width ${box?.width}`);
  for (const word of ["Search", "Select Region", "All the cities", "Select District", "Filters", "DELETE ALL", "SEARCH"]) {
    if (!text.includes(word)) notes.push(word);
  }
  if (!(await page.locator("[data-tk=search-district]").isDisabled())) notes.push("district");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  if (await modal.isVisible()) notes.push("esc");
  if (width === 1440) {
    await page.locator("[data-tk=hero-search]").click();
    await page.locator("[data-tk=search-text]").fill("a");
    await Promise.all([
      page.waitForURL(/\/search\/|\/dating\//, { timeout: 8000 }).catch(() => {}),
      page.locator("[data-tk=search-submit]").click(),
    ]);
    if (!/\/search\/|\/dating\//.test(page.url())) notes.push(page.url());
  }
  record("/ search-modal", width, notes.length === 0, notes.join("; "));
  await page.close();
}

if (adPath) {
  for (const [width, height] of widths) {
    const { page } = await visit(adPath, width, height);
    const notes = [];
    if ((await page.locator("[data-tk=ad-summary]").count()) < 1) notes.push("summary");
    if ((await page.locator("[data-tk=call]").count()) < 2) notes.push("call");
    if ((await page.locator("[data-tk=whatsapp]").count()) < 2) notes.push("wa");
    if ((await page.locator("[data-tk=security-tips]").count()) < 1) notes.push("tips");
    if (width === 390) {
      const bar = page.locator("[data-tk=bottom-bar]");
      const pos = await bar.evaluate((el) => getComputedStyle(el).position).catch(() => "");
      if (pos !== "fixed") notes.push("bottom");
    }
    await page.locator("[data-tk=gallery] img").first().waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
    await page.waitForFunction(() => [...document.querySelectorAll("[data-tk=gallery] img")].every((img) => img.complete && img.naturalWidth > 0), { timeout: 8000 }).catch(() => {});
    const gallery = await page.locator("[data-tk=gallery] img").evaluateAll((els) =>
      els.map((el) => {
        const box = el.getBoundingClientRect();
        return {
          src: el.currentSrc || el.getAttribute("src") || "",
          broken: el.complete && el.naturalWidth === 0,
          visible: box.width > 20 && box.height > 20,
          height: box.height,
        };
      }),
    );
    const visible = gallery.filter((item) => item.visible);
    if (width < 768) {
      if (visible.length !== 1) notes.push(`mobile gallery ${visible.length}`);
      if ((visible[0]?.height || 0) < 200) notes.push(`mobile photo ${visible[0]?.height}`);
      if ((await page.locator("[data-tk=show-all]").count()) < 1) notes.push("show all");
    } else if (visible.length < 4) notes.push(`gallery ${visible.length}`);
    if (new Set(visible.map((item) => item.src)).size < Math.min(4, visible.length)) notes.push("portraits repeat");
    if (visible.some((item) => item.broken || !decodeURIComponent(item.src).includes("/placeholders/profiles/"))) notes.push("gallery photo");
    const share = await page.locator('a[href*="twitter.com"]').getAttribute("href");
    if (!share || !decodeURIComponent(share).startsWith("https://twitter.com/intent/tweet?url=http")) notes.push("share");
    if (width === 1440) {
      const waitReveal = page.waitForResponse((res) => res.url().includes("contact-reveal"), { timeout: 8000 }).catch(() => null);
      await page.locator("[data-tk=ad-summary] [data-tk=call]").click();
      await waitReveal;
      await page.waitForTimeout(300);
      const shown = await page.locator("[data-tk=ad-summary]").innerText();
      if (!/\d{6,}/.test(shown)) {
        await page.locator("[data-tk=ad-summary] [data-tk=call]").click().catch(() => {});
        await page.waitForTimeout(400);
      }
      const again = await page.locator("[data-tk=ad-summary]").innerText();
      if (!/\d{6,}/.test(again)) notes.push("reveal");
    }
    record(adPath + " structure", width, notes.length === 0, notes.join("; "));
    await page.close();
  }
} else record("/ad/", 1440, false, "no ad link");

const cityPage = await context.newPage();
await cityPage.setViewportSize({ width: 1440, height: 900 });
await cityPage.goto(base + "/dating/bengaluru/", { waitUntil: "load" });
const cards = await cityPage.locator("[data-tk=card]").count();
const notes = [];
if (cards < 12) notes.push(`cards ${cards}`);
const variants = await cityPage.locator("[data-tk=card]").evaluateAll((els) => els.every((el) => el.getAttribute("data-variant")));
if (!variants) notes.push("variant");
if ((await cityPage.locator("[data-tk=location-field]").count()) < 1) notes.push("location");
if (cards >= 7 && (await cityPage.locator("[data-tk=promo-band]").count()) < 1) notes.push("promo");
const loc = await cityPage.locator(".tk-loc-go").boundingBox();
if (!loc || Math.abs(loc.width - 34) > 2 || Math.abs(loc.height - 34) > 2) notes.push(`search ${loc?.width}x${loc?.height}`);
await cityPage.locator("[data-tk=card] img").first().waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
await cityPage.waitForFunction(() => [...document.querySelectorAll("[data-tk=card] img")].every((img) => img.complete && img.naturalWidth > 0), { timeout: 8000 }).catch(() => {});
const cardPhotos = await cityPage.locator("[data-tk=card] img").evaluateAll((els) =>
  els.map((el) => ({
    src: el.currentSrc || el.getAttribute("src") || "",
    broken: el.complete && el.naturalWidth === 0,
    box: el.getBoundingClientRect(),
  })),
);
if (!cardPhotos.length || cardPhotos.some((item) => item.broken || !decodeURIComponent(item.src).includes("/placeholders/profiles/"))) notes.push("card photo");
if (cardPhotos.some((item) => item.box.height > 0 && Math.abs(item.box.width / item.box.height - 0.8) > 0.12)) notes.push("card ratio");
record("/dating/bengaluru/ structure", 1440, notes.length === 0, notes.join("; "));
await cityPage.close();

const narrowCity = await context.newPage();
await narrowCity.setViewportSize({ width: 390, height: 844 });
await narrowCity.goto(base + "/dating/bengaluru/", { waitUntil: "load" });
const overlap = await narrowCity.evaluate(() => {
  function hits(a, b) {
    if (!a || !b) return false;
    const A = a.getBoundingClientRect();
    const B = b.getBoundingClientRect();
    return A.width > 0 && B.width > 0 && A.left < B.right && A.right > B.left && A.top < B.bottom && A.bottom > B.top;
  }
  const card = document.querySelector('.tk-card[data-variant="supertop"], .tk-card[data-variant="star"]');
  if (!card) return "no-promoted-card";
  if (hits(card.querySelector(".tk-badge-promo"), card.querySelector(".tk-card-title"))) return "badge-title";
  if (hits(card.querySelector(".tk-circles"), card.querySelector(".tk-card-meta"))) return "circles-location";
  const photo = card.querySelector("img")?.getBoundingClientRect();
  if (photo && photo.height > 0 && Math.abs(photo.width / photo.height - 0.8) > 0.12) return "ratio";
  return "";
});
record("/dating/bengaluru/ overlap", 390, overlap === "", overlap);
const register = await context.newPage();
await register.setViewportSize({ width: 390, height: 844 });
await register.goto(base + "/u/register/", { waitUntil: "load" });
const labelOverlap = await register.evaluate(() => {
  function hits(a, b) {
    const A = a.getBoundingClientRect();
    const B = b.getBoundingClientRect();
    return A.width > 0 && B.width > 0 && A.left < B.right && A.right > B.left && A.top < B.bottom && A.bottom > B.top;
  }
  return [...document.querySelectorAll("form label")].some((label) => {
    const box = label.querySelector("input[type=checkbox]");
    const text = label.querySelector("span");
    return box && text && hits(box, text);
  });
});
record("/u/register/ labels", 390, labelOverlap === false, labelOverlap ? "checkbox overlaps label" : "");
await narrowCity.close();
await register.close();

for (const district of ["/dating/delhi/central-delhi/", "/dating/delhi/new-delhi/", "/dating/delhi/south-delhi/"]) {
  for (const [width, height] of widths) {
    const { page } = await visit(district, width, height);
    await page.close();
  }
}
for (const [width, height] of widths) {
  const latest = await context.newPage();
  await latest.setViewportSize({ width, height });
  await latest.goto(base + "/", { waitUntil: "load" });
  await latest.locator("[data-tk=latest-card]").first().waitFor({ timeout: 8000 }).catch(() => {});
  const note = await latest.evaluate(() => {
    const cards = [...document.querySelectorAll("[data-tk=latest-card]")];
    if (!cards.length) return "missing";
    function hits(a, b) {
      if (!a || !b) return false;
      const A = a.getBoundingClientRect();
      const B = b.getBoundingClientRect();
      return A.width > 0 && B.width > 0 && A.left < B.right - 1 && A.right > B.left + 1 && A.top < B.bottom - 1 && A.bottom > B.top + 1;
    }
    for (const card of cards) {
      const box = card.getBoundingClientRect();
      if (box.right > window.innerWidth + 1 || box.left < -1) return "overflow";
      if (hits(card.querySelector(".tk-card-photo"), card.querySelector(".tk-card-title"))) return "photo-title";
      if (!card.querySelector(".tk-latest-chip")) return "chip";
      if (!card.querySelector(".tk-card-photo img, .tk-card-photo .tk-ph")) return "thumb";
    }
    return "";
  });
  record("latest ads", width, note === "", note || "grid");
  await latest.close();
}
for (const path of ["/admin/listings/", "/admin/promotions/", "/admin/pages/"]) {
  const adminRes = await context.request.get(base + path);
  const adminText = await adminRes.text();
  record(path, 1440, adminRes.status() === 200 && !/could not be found/i.test(adminText), String(adminRes.status()));
}
const mapRes = await context.request.get(base + "/sitemap.xml");
const mapText = await mapRes.text();
const shardRes = await context.request.get(base + "/sitemap/cities.xml");
const shardText = await shardRes.text();
const districtRes = await context.request.get(base + "/sitemap/districts.xml");
const districtText = await districtRes.text();
const contentRes = await context.request.get(base + "/sitemap/content.xml");
const contentText = await contentRes.text();
const adsRes = await context.request.get(base + "/sitemap/ads.xml");
const adsText = await adsRes.text();
const mapOk =
  mapRes.ok() &&
  mapText.includes("<sitemapindex") &&
  mapText.includes("/sitemap/cities.xml") &&
  mapText.includes("/sitemap/districts.xml") &&
  mapText.includes("/sitemap/tags.xml") &&
  mapText.includes("/sitemap/ads.xml") &&
  shardRes.ok() &&
  shardText.includes("<lastmod>") &&
  shardText.includes("/dating/gurgaon/") &&
  districtRes.ok() &&
  districtText.includes("<urlset") &&
  contentRes.ok() &&
  contentText.includes("/cities/") &&
  contentText.includes("/blog/") &&
  contentText.includes("/help/") &&
  contentText.includes("/cms/about/") &&
  contentText.includes("/scam-report/") &&
  contentText.includes("/safety/") &&
  contentText.includes("/categories/") &&
  adsRes.ok() &&
  adsText.includes("<urlset");
record("/sitemap.xml", 1440, mapOk, mapOk ? "index and shards" : mapText.slice(0, 80));
const contentLocs = [...contentText.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const duplicateLocs = contentLocs.filter((loc, index) => contentLocs.indexOf(loc) !== index);
record("sitemap unique", 1440, duplicateLocs.length === 0, duplicateLocs.slice(0, 3).join(" ") || `${contentLocs.length} urls`);
const deep = await context.request.get(base + "/dating/gurgaon/?page=99");
record("/dating/gurgaon/?page=99", 1440, deep.status() === 404, String(deep.status()));
for (const [asset, type] of [
  ["/favicon.ico", "icon"],
  ["/apple-touch-icon.png", "png"],
  ["/brand/icon-192.png", "png"],
  ["/brand/icon-512.png", "png"],
  ["/brand/og-default.png", "png"],
]) {
  const assetRes = await context.request.get(base + asset);
  const assetType = assetRes.headers()["content-type"] || "";
  record(asset, 1440, assetRes.ok() && (type === "icon" || assetType.includes("png")), assetType || String(assetRes.status()));
}
const gurgaon = await context.request.get(base + "/dating/gurgaon/");
const gurgaonText = await gurgaon.text();
record("/dating/gurgaon/", 1440, gurgaon.ok() && gurgaonText.includes("Dating in Gurgaon"), gurgaon.status());
const manifest = await context.request.get(base + "/manifest.webmanifest");
const manifestText = await manifest.text();
record("/manifest.webmanifest", 1440, manifest.ok() && manifestText.includes("Tharkoo"), manifest.status());

const loggedOut = await context.newPage();
await loggedOut.setViewportSize({ width: 1440, height: 900 });
await loggedOut.goto(base + "/", { waitUntil: "load" });
await loggedOut.locator("[data-tk=header] [data-tk=post-ad]").click();
await loggedOut.waitForURL(/\/u\/login\//, { timeout: 15000 }).catch(() => {});
const landed = new URL(loggedOut.url());
const nextOk = landed.pathname.startsWith("/u/login") && landed.searchParams.get("next") === "/u/post-insert/";
const wizardFlash = await loggedOut.locator("[data-tk=step-title]").count();
record("post-ad logged-out", 1440, nextOk && wizardFlash === 0, loggedOut.url());
const createHref = await loggedOut.getByRole("link", { name: "Create account" }).getAttribute("href");
record("post-ad register link", 1440, Boolean(createHref && createHref.includes("next=") && createHref.includes("post-insert")), createHref || "");
await loggedOut.goto(base + (createHref || "/u/register/?next=%2Fu%2Fpost-insert%2F"), { waitUntil: "load" });
const postEmail = `post+${Date.now()}@example.test`;
const postPassword = "SmokePass1!";
await loggedOut.locator("#email").fill(postEmail);
await loggedOut.locator("#displayName").fill("Poster");
await loggedOut.locator("#password").fill(postPassword);
await loggedOut.locator("#dateOfBirth").fill("1990-01-01");
await loggedOut.locator("input[name=acceptedTerms]").check();
await loggedOut.locator("input[name=attestedAdult]").check();
await loggedOut.getByRole("button", { name: "CREATE ACCOUNT" }).click();
await loggedOut.waitForURL(/\/u\/post-insert\//, { timeout: 20000 }).catch(() => {});
const afterRegister = await loggedOut.locator("[data-tk=step-title]").innerText().catch(() => "");
record("post-ad register", 1440, /Information/i.test(afterRegister), loggedOut.url() + " " + afterRegister);
await loggedOut.goto(base + "/u/logout/", { waitUntil: "load" });
await loggedOut.waitForURL(/\/$/, { timeout: 15000 }).catch(() => {});
await loggedOut.goto(base + "/u/login/?next=%2Fu%2Fpost-insert%2F", { waitUntil: "load" });
await loggedOut.locator("#email").fill(postEmail);
await loggedOut.locator("#password").fill(postPassword);
await loggedOut.getByRole("button", { name: "LOG IN" }).click();
await loggedOut.waitForURL(/\/u\/post-insert\//, { timeout: 20000 }).catch(() => {});
const afterLogin = await loggedOut.locator("[data-tk=step-title]").innerText().catch(() => "");
record("post-ad login", 1440, /Information/i.test(afterLogin), loggedOut.url() + " " + afterLogin);
const adTitle = `Smoke listing ${Date.now()}`;
await loggedOut.locator("#category").selectOption({ label: "Jobs" });
await loggedOut.locator("#city").selectOption({ label: "Mumbai" });
await loggedOut.locator("#nickname").fill("Poster");
await loggedOut.locator("#role").fill("Office assistant");
await loggedOut.locator("#title").fill(adTitle);
await loggedOut.locator("#text").fill("A weekday office role with a clear description of the work.");
await loggedOut.locator("#phone").fill("9876543210");
await loggedOut.locator("p").filter({ hasText: "Terms, Conditions" }).locator("button").click();
await loggedOut.locator("p").filter({ hasText: "I confirm that I am 18" }).locator("button").click();
await loggedOut.locator("[data-tk=go-on]").click();
await loggedOut.locator("[data-tk=photo-input]").waitFor({ state: "attached", timeout: 15000 }).catch(() => {});
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
await loggedOut.locator("[data-tk=photo-input]").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: png });
await loggedOut.locator("[data-tk=photo-note]").waitFor({ timeout: 15000 }).catch(() => {});
const photoNote = await loggedOut.locator("[data-tk=photo-note]").innerText().catch(() => "");
await loggedOut.locator("[data-tk=go-on]").click();
const publishErrors = [];
loggedOut.on("console", (msg) => {
  if (msg.type() === "error") publishErrors.push(msg.text());
});
await loggedOut.locator("button", { hasText: "PUBLISH" }).click();
await loggedOut.locator("[data-tk=verify-id]").waitFor({ timeout: 15000 }).catch(() => {});
const verifyText = await loggedOut.locator("[aria-live=polite]").innerText().catch(() => "");
const blocked = /quick check/i.test(verifyText) && !/403/.test(verifyText) && !publishErrors.some((line) => /403|Failed to load resource/i.test(line));
record("post-ad kyc message", 1440, blocked && /Photo saved/i.test(photoNote), `${photoNote} | ${verifyText}`);
const draftUrl = loggedOut.url();
await loggedOut.locator("[data-tk=verify-id]").click();
await loggedOut.locator("#front-id").setInputFiles({ name: "front.png", mimeType: "image/png", buffer: png });
await loggedOut.locator("#selfie-id").setInputFiles({ name: "selfie.png", mimeType: "image/png", buffer: png });
await loggedOut.locator("[data-tk=kyc-submit]").click();
await loggedOut.locator("[data-tk=kyc-note]").waitFor({ timeout: 15000 }).catch(() => {});
const kycNote = await loggedOut.locator("[data-tk=kyc-note]").innerText().catch(() => "");
const adminApi = await browser.newContext();
const adminLogin = await adminApi.request.post(base + "/api/auth/login/", {
  headers: { origin: base, referer: base + "/admin/login/" },
  data: { email: process.env.ADMIN_BOOTSTRAP_EMAIL || "homepage-admin@example.test", password: process.env.ADMIN_BOOTSTRAP_PASSWORD || "HomepageAdmin1!" },
});
const queue = await adminApi.request.get(base + "/api/admin/verifications/?page=1&pageSize=20");
const queueBody = await queue.json().catch(() => ({}));
const pending = queueBody?.data?.items || [];
const verificationId = pending[pending.length - 1]?.id;
const decision = verificationId
  ? await adminApi.request.post(base + `/api/admin/verifications/${verificationId}/decision/`, {
      headers: { origin: base, referer: base + "/admin/" },
      data: { decision: "approved", reason: "Documents match the account" },
    })
  : null;
await adminApi.close();
record("post-ad kyc approve", 1440, adminLogin.ok() && decision?.ok() === true && /review/i.test(kycNote), `login ${adminLogin.status()} decide ${decision?.status()} ${kycNote}`);
await loggedOut.goto(draftUrl.includes("step=") ? draftUrl.replace(/step=\d+/, "step=3") : draftUrl, { waitUntil: "load" });
await loggedOut.locator("[data-tk=card]").waitFor({ timeout: 15000 }).catch(() => {});
await loggedOut.locator("button", { hasText: "PUBLISH" }).click();
await loggedOut.locator("[data-tk=step-title]").filter({ hasText: "live" }).waitFor({ timeout: 15000 }).catch(() => {});
const live = await loggedOut.locator("[data-tk=step-title]").innerText().catch(() => "");
await loggedOut.goto(base + "/u/account/ads/", { waitUntil: "load" });
await loggedOut.locator("[data-tk=card]").filter({ hasText: adTitle }).waitFor({ timeout: 15000 }).catch(() => {});
const mine = await loggedOut.locator("body").innerText();
const adLink = await loggedOut.locator("[data-tk=card]").filter({ hasText: adTitle }).locator('a[href*="/ad/"]').first().getAttribute("href").catch(() => "");
let publicOk = false;
if (adLink) {
  await loggedOut.goto(base + adLink, { waitUntil: "load" });
  publicOk = (await loggedOut.locator("h1").innerText().catch(() => "")).includes(adTitle.slice(0, 12));
}
record("post-ad published", 1440, /live/i.test(live) && mine.includes(adTitle) && publicOk, `${live} ${adLink}`);
await loggedOut.close();

const email = `smoke+${Date.now()}@example.test`;
const password = "SmokePass1!";
const apiContext = await browser.newContext();
const reg = await apiContext.request.post(base + "/api/auth/register", {
  headers: { origin: base, referer: base + "/" },
  data: { email, password, displayName: "Smoke", dateOfBirth: "1990-01-01", acceptedTerms: true, attestedAdult: true },
});
if (!reg.ok()) record("/api/auth/register", 1440, false, `status ${reg.status()} ${await reg.text()}`);
const loginRes = await apiContext.request.post(base + "/api/auth/login", {
  headers: { origin: base, referer: base + "/u/login/" },
  data: { email, password },
});
if (!loginRes.ok()) record("/api/auth/login", 1440, false, `status ${loginRes.status()} ${await loginRes.text()}`);
await apiContext.close();
await context.clearCookies();
const loginPage = await context.newPage();
await loginPage.setViewportSize({ width: 1440, height: 900 });
await loginPage.goto(base + "/u/login/", { waitUntil: "load" });
await loginPage.locator("#email").fill(email);
await loginPage.locator("#password").fill(password);
await loginPage.getByRole("button", { name: "LOG IN" }).click();
await loginPage.waitForURL(/\/u\/account\/dashboard\/|\/admin\//, { timeout: 15000 }).catch(() => {});
record("/u/login/ form", 1440, /dashboard|admin/.test(loginPage.url()), loginPage.url());
await loginPage.close();

for (const [width, height] of widths) {
  for (const path of signedPaths) {
    const { page } = await visit(path, width, height);
    if (path === "/u/account/dashboard/" && width === 1440) {
      const extra = [];
      for (const tile of ["ads", "wallet", "coupons", "settings"]) {
        if ((await page.locator(`[data-tk=tile][data-tile=${tile}]`).count()) < 1) extra.push(tile);
      }
      if ((await page.locator("[data-tk=help-card]").count()) < 1) extra.push("help");
      record("/u/account/dashboard/ structure", width, extra.length === 0, extra.join("; "));
    }
    if (path === "/u/account/credits/" && width === 1440) {
      const text = await page.locator("body").innerText();
      const extra = [];
      if ((await page.locator("[data-tk=pack]").count()) < 1) extra.push("pack");
      for (const word of ["Buy Credits", "TOTAL", "PAY"]) if (!text.includes(word)) extra.push(word);
      record("/u/account/credits/ structure", width, extra.length === 0, extra.join("; "));
    }
    if (path === "/u/account/coupons/" && width === 1440) {
      const text = await page.locator("body").innerText();
      record("/u/account/coupons/ structure", width, text.includes("APPLY"), text.includes("APPLY") ? "" : "APPLY");
    }
    if (path === "/u/account/edit-account/" && width === 1440) {
      const text = await page.locator("body").innerText();
      const ok = text.includes("CHANGE PASSWORD") && text.includes("Delete my account");
      record("/u/account/edit-account/ structure", width, ok, ok ? "" : "settings copy");
    }
    if (path === "/u/account/ads/" && width === 1440) {
      const text = await page.locator("body").innerText();
      const ok = text.includes("Active") && text.includes("Not published");
      record("/u/account/ads/ structure", width, ok, ok ? "" : "tabs");
    }
    if (path === "/u/post-insert/" && width === 1440) {
      const extra = [];
      if ((await page.locator("[data-tk=progress] i").count()) !== 3) extra.push("progress");
      const title = await page.locator("[data-tk=step-title]").innerText();
      if (!/Information/i.test(title)) extra.push(title);
      await page.locator("[data-tk=go-on]").click();
      await page.waitForTimeout(200);
      const errs = await page.locator("[data-tk=field-error]").allInnerTexts();
      if (errs.length < 5) extra.push(`errors ${errs.length}`);
      if (!errs.some((item) => item.includes("Please, fill in this field"))) extra.push("select message");
      if (!errs.some((item) => item.includes("Name / Nickname is required"))) extra.push("nickname");
      await page.locator("#category").selectOption({ index: 1 });
      await page.locator("#city").selectOption({ index: 1 });
      await page.locator("#nickname").fill("Asha");
      await page.locator("#title").fill("Hello friends nearby");
      await page.locator("#text").fill("Looking for coffee and conversation this weekend in the city.");
      await page.locator("#phone").fill("+919876543210");
      if (await page.locator("#age").count()) await page.locator("#age").fill("28");
      if (await page.locator(".tk-choice").count()) await page.locator(".tk-choice").first().click();
      const switches = page.locator(".tk-switch");
      await switches.nth(2).click();
      await switches.nth(3).click();
      await page.locator("[data-tk=go-on]").click();
      await page.waitForTimeout(800);
      const step2 = await page.locator("[data-tk=step-title]").innerText();
      if (!/Photos/i.test(step2)) extra.push(`step2 ${step2} ${await page.locator("[aria-live=polite]").innerText()}`);
      else {
        await page.locator("[data-tk=go-on]").click();
        await page.waitForTimeout(200);
        const step3 = await page.locator("[data-tk=step-title]").innerText();
        if (!/Publish/i.test(step3)) extra.push(`step3 ${step3}`);
      }
      record("/u/post-insert/ structure", width, extra.length === 0, extra.join("; "));
    }
    await page.close();
  }
}

const click = await context.newPage();
await click.setViewportSize({ width: 1440, height: 900 });
const clickErrors = [];
click.on("console", (msg) => {
  if (msg.type() === "error" && !/Failed to load resource/i.test(msg.text())) clickErrors.push(msg.text().slice(0, 160));
});
click.on("pageerror", (err) => clickErrors.push(String(err).slice(0, 160)));
await click.goto(base + "/", { waitUntil: "load" });
const homeLinks = await click.locator("[data-tk=header] a, [data-tk=hero] a, [data-tk=hero] button, [data-tk=home-card] a").evaluateAll((els) =>
  els.slice(0, 8).map((el) => el.getAttribute("href")).filter(Boolean),
);
for (const href of homeLinks) {
  if (!href.startsWith("/")) continue;
  await click.goto(base + href, { waitUntil: "load" }).catch(() => {});
}
await click.goto(base + "/dating/bengaluru/", { waitUntil: "load" });
const cardLinks = await click.locator("[data-tk=card] a").evaluateAll((els) => els.slice(0, 6).map((el) => el.getAttribute("href")).filter(Boolean));
for (const href of cardLinks) {
  if (!href.startsWith("/")) continue;
  await click.goto(base + href, { waitUntil: "load" }).catch(() => {});
}
record("/ click-through", 1440, clickErrors.length === 0, clickErrors[0] || "");
await click.close();

const adminContext = await browser.newContext();
await adminContext.addInitScript(() => {
  localStorage.setItem("nl-age", "ok");
  localStorage.setItem("nl-cookies", "all");
});
const adminPage = await adminContext.newPage();
await adminPage.setViewportSize({ width: 1440, height: 900 });
await adminPage.goto(base + "/admin/login/", { waitUntil: "load" });
await adminPage.locator("#email").fill(process.env.ADMIN_BOOTSTRAP_EMAIL || "homepage-admin@example.test");
await adminPage.locator("#password").fill(process.env.ADMIN_BOOTSTRAP_PASSWORD || "HomepageAdmin1!");
await adminPage.getByRole("button", { name: "Sign in" }).click();
await adminPage.waitForURL((url) => /\/admin\/?$/.test(url.pathname), { timeout: 15000 }).catch(() => {});
const signedIn = /\/admin\/?$/.test(new URL(adminPage.url()).pathname);
if (!signedIn) {
  const msg = await adminPage.locator("[aria-live=polite]").innerText().catch(() => "");
  record("homepage edit", 1440, false, `${adminPage.url()} ${msg}`.trim());
} else await adminPage.goto(base + "/admin/homepage/", { waitUntil: "load" });
const heroInput = adminPage.locator("#hero-desktop");
const editorReady = signedIn && (await heroInput.count()) > 0;
if (editorReady) {
  await heroInput.fill("Hello from the homepage editor");
  await adminPage.getByRole("button", { name: "Save" }).click();
  await adminPage.getByText("Saved.").waitFor({ timeout: 10000 }).catch(() => {});
  await adminPage.goto(base + "/", { waitUntil: "load" });
  const edited = await adminPage.locator("[data-tk=hero] h1").innerText().catch(() => "");
  record("homepage edit", 1440, edited.includes("Hello from the homepage editor"), edited.slice(0, 80));
  await adminPage.goto(base + "/admin/homepage/", { waitUntil: "load" });
  adminPage.once("dialog", (dialog) => dialog.accept());
  await adminPage.getByRole("button", { name: "Reset to default" }).click();
  await adminPage.getByText("Reset to the original").waitFor({ timeout: 10000 }).catch(() => {});
  await adminPage.goto(base + "/", { waitUntil: "load" });
  const restored = await adminPage.locator("[data-tk=hero] h1").innerText().catch(() => "");
  record("homepage reset", 1440, restored.includes("Single?"), restored.slice(0, 80));
} else if (signedIn) record("homepage edit", 1440, false, await adminPage.locator("body").innerText().then((text) => text.slice(0, 120)).catch(() => adminPage.url()));
if (signedIn) {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ]) {
    await adminPage.setViewportSize({ width, height });
    await adminPage.goto(base + "/admin/urls/", { waitUntil: "load" });
    const text = await adminPage.locator("body").innerText();
    const scroll = await adminPage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    record("/admin/urls/", width, text.includes("Path prefixes") && text.includes("Redirects") && scroll <= 1, `scroll ${scroll}`);
  }
}
await adminPage.close();
await adminContext.close();

if (badStatus.length) record("/ responses", 0, false, badStatus.slice(0, 3).join(" | "));

console.log("\npath | width | result | note");
for (const row of rows) console.log(`${row.path} | ${row.width} | ${row.ok ? "pass" : "fail"} | ${row.note}`);
await browser.close();
process.exit(failed ? 1 : 0);
