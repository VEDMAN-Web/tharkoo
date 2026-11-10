import { chromium } from "@playwright/test";

const base = process.env.BASE_URL || "http://127.0.0.1:4317";
const widths = [
  [1440, 900],
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
  if (res.status() >= 400 && !url.includes("this-page-does-not-exist")) badStatus.push(`${res.status()} ${url}`);
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
  if (width === 390 && facts.overflow) notes.push("overflow");
  if (facts.h1 !== 1) notes.push(`h1 ${facts.h1}`);
  if (!/Manrope/i.test(facts.family)) notes.push(`font ${facts.family}`);
  if (facts.tiny) notes.push(`tiny ${facts.tiny}`);
  if (!/noindex/i.test(facts.robots) && !facts.canonical && expectStatus === 200) notes.push("canonical");
  if (facts.scheme !== "light") notes.push(`scheme ${facts.scheme}`);
  if (facts.bodyLum < 0.9) notes.push(`body ${facts.bodyLum.toFixed(2)}`);
  if (facts.dark.length) notes.push(`dark ${facts.dark[0]}`);
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
      await page.locator("[data-tk=home-card]").first().waitFor({ timeout: 8000 }).catch(() => {});
      if ((await page.locator("[data-tk=home-card]").count()) !== 5) extra.push(`cards ${await page.locator("[data-tk=home-card]").count()}`);
      const post = page.locator("[data-tk=header] [data-tk=post-ad]");
      if ((await post.innerText()) !== "POST YOUR AD") extra.push("post");
      const pos = await page.locator("[data-tk=header]").evaluate((el) => getComputedStyle(el).position);
      if (pos === "sticky" || pos === "fixed") extra.push("sticky");
      const box = await page.locator(".tk-container").first().boundingBox();
      if (!box || Math.abs(box.width - 960) > 2) extra.push(`container ${box?.width}`);
      const h2 = await page.locator("h2").first().innerText();
      if (!/Hot meetings in your city/i.test(h2)) extra.push("h2");
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
if (cards < 3) notes.push(`cards ${cards}`);
const variants = await cityPage.locator("[data-tk=card]").evaluateAll((els) => els.every((el) => el.getAttribute("data-variant")));
if (!variants) notes.push("variant");
if ((await cityPage.locator("[data-tk=location-field]").count()) < 1) notes.push("location");
if (cards >= 7 && (await cityPage.locator("[data-tk=promo-band]").count()) < 1) notes.push("promo");
record("/dating/bengaluru/ structure", 1440, notes.length === 0, notes.join("; "));
await cityPage.close();

const email = `smoke+${Date.now()}@example.test`;
const password = "SmokePass1!";
const reg = await context.request.post(base + "/api/auth/register", {
  headers: { origin: base, referer: base + "/" },
  data: { email, password, displayName: "Smoke", dateOfBirth: "1990-01-01", acceptedTerms: true, attestedAdult: true },
});
if (!reg.ok()) record("/api/auth/register", 1440, false, `status ${reg.status()} ${await reg.text()}`);
const loginRes = await context.request.post(base + "/api/auth/login", {
  headers: { origin: base, referer: base + "/u/login/" },
  data: { email, password },
});
const setCookies = loginRes.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie");
for (const header of setCookies) {
  const [pair, ...attrs] = header.value.split(";");
  const eq = pair.indexOf("=");
  await context.addCookies([
    {
      name: pair.slice(0, eq).trim(),
      value: decodeURIComponent(pair.slice(eq + 1).trim()),
      url: base,
      httpOnly: attrs.some((attr) => /httponly/i.test(attr)),
    },
  ]);
}
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

if (badStatus.length) record("/ responses", 0, false, badStatus.slice(0, 3).join(" | "));

console.log("\npath | width | result | note");
for (const row of rows) console.log(`${row.path} | ${row.width} | ${row.ok ? "pass" : "fail"} | ${row.note}`);
await browser.close();
process.exit(failed ? 1 : 0);
