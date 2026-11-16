import { chromium, expect as plainExpect, test as plainTest } from "@playwright/test";
import { expect, loginUi, newUserApi, test, withLocalDb } from "./helpers";

const SHOTS = process.env.POST_SHOTS ?? "";

test.describe("H7.110 small fixes (4-4)", () => {
  test("A19: the Cities search example names real cities from the page, not Vesu", async ({ page }) => {
    await page.goto("/cities/");
    const input = page.locator("form[role=search] input[name=q]");
    const hint = (await input.getAttribute("placeholder")) ?? "";
    expect(hint).toMatch(/^Type a city or area, e\.g\. \S+/);
    expect(hint).not.toContain("Vesu");
    const names = hint.replace("Type a city or area, e.g. ", "").split(", ");
    const chips = await page.locator(".h714-chips a").allTextContents();
    for (const name of names) expect(chips.join("|"), name).toContain(name);
    const found = await page.request.get(`/search/?q=${encodeURIComponent(names[0])}`);
    expect(found.status()).toBe(200);
  });

  test("A21: a tag page reads Category: Tag, in the H1 and the title", async ({ page }) => {
    await page.goto("/dating/tag/online/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dating: Online");
    await expect(page).toHaveTitle("Dating: Online ads | Tharkoo");
    await expect(page.getByText("Online Dating")).toHaveCount(0);
  });

  test("A27: a signed-in visitor on the login page goes to the account, or to a safe next address", async ({ page, baseURL }) => {
    const { api, email } = await newUserApi(baseURL!, "loginredirect");
    await loginUi(page, email, undefined, "/");
    await page.goto("/u/login/");
    await expect(page).toHaveURL(/\/u\/account\/$/);
    await page.goto("/u/login/?next=/u/account/saved/");
    await expect(page).toHaveURL(/\/u\/account\/saved\/$/);
    await page.goto(`/u/login/?next=${encodeURIComponent("https://evil.example/")}`);
    await expect(page).toHaveURL(/\/u\/account\/$/);
    await api.dispose();
  });

  test("A27: a signed-out visitor still sees the login sheet", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL });
    await context.addInitScript(() => {
      localStorage.setItem("nl-age", "ok");
      localStorage.setItem("nl-cookies", "necessary");
    });
    const page = await context.newPage();
    await page.goto("/u/login/");
    await expect(page.getByRole("heading", { name: "Welcome to Tharkoo" })).toBeVisible();
    await context.close();
  });

  test("G2: the forgot password page is one card, not a card inside a card", async ({ page }, info) => {
    await page.goto("/u/forgot/");
    const cards = await page.evaluate(() => {
      const outer = document.querySelector(".reset-card") as HTMLElement;
      const shadowed = Array.from(outer.querySelectorAll<HTMLElement>("*")).filter((node) => {
        const style = getComputedStyle(node);
        return style.boxShadow !== "none" && style.display !== "inline" && !node.matches("button, a, input");
      });
      const inner = outer.querySelector<HTMLElement>(".tk-auth");
      const rect = outer.getBoundingClientRect();
      const innerRect = inner?.getBoundingClientRect();
      return { shadowed: shadowed.length, background: inner ? getComputedStyle(inner).backgroundColor : "", gap: innerRect ? Math.round(innerRect.left - rect.left) : -1 };
    });
    expect(cards.shadowed).toBe(0);
    expect(cards.background).toBe("rgba(0, 0, 0, 0)");
    expect(cards.gap).toBeGreaterThanOrEqual(30);
    expect(cards.gap).toBeLessThanOrEqual(40);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/h7-110-forgot-${info.project.name}.png` });
  });

  test("G7: an unknown address answers 404 with the title Page not found | Tharkoo", async ({ page }) => {
    const res = await page.goto("/no-such-page-h7110/");
    expect(res?.status()).toBe(404);
    await expect(page).toHaveTitle("Page not found | Tharkoo");
  });

  test("V19: with no tour requests the Live video tours block is one line with a link", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const { api, email } = await newUserApi(baseURL!, "tourline");
    await loginUi(page, email, undefined, "/u/account/");
    const { becomeSeller } = await import("./helpers");
    await becomeSeller(page, baseURL!);
    await page.goto("/u/account/");
    const line = page.locator("[data-tk=tour-inbox]");
    await expect(line).toHaveAttribute("data-empty", "yes");
    await expect(line).toContainText("Live video tours");
    await expect(line.getByRole("link", { name: "How video tours work" })).toHaveAttribute("href", "/how-it-works/");
    expect((await line.boundingBox())!.height).toBeLessThan((page.viewportSize()?.width ?? 1440) < 600 ? 100 : 64);
    await expect(page.locator(".tk-dcard")).toHaveCount(0);
    if (SHOTS) {
      await line.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/h7-110-tours-line.png` });
    }
    await api.dispose();
  });

  test("the age gate button reads Accept, in sentence case", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await page.goto("/");
    const button = page.locator("[data-tk=age-accept]");
    await expect(button).toBeVisible();
    await expect(button).toHaveText("Accept");
    expect(await button.evaluate((node) => getComputedStyle(node).textTransform)).toBe("none");
    await context.close();
  });

  test("A30: each category count on /categories/ matches the live ads in the database", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/categories/");
    const cards = page.locator("a[href^='/'][href$='/']").filter({ hasText: /\d[\d,]* ads?/ });
    const shown = await cards.evaluateAll((nodes) =>
      nodes.map((node) => ({ href: node.getAttribute("href") ?? "", count: Number((node.textContent ?? "").match(/(\d[\d,]*) ads?/)?.[1].replace(/,/g, "") ?? -1) })),
    );
    const counts = await withLocalDb(async (db) => {
      const categories = await db.collection("categories").find({}).project({ slug: 1 }).toArray();
      const out: Record<string, number> = {};
      for (const category of categories) out[String(category.slug)] = await db.collection("listings").countDocuments({ categoryId: category._id, status: "active" });
      return out;
    });
    const rows = shown.filter((row) => counts && counts[row.href.replace(/\//g, "")] !== undefined);
    expect(rows.length).toBeGreaterThan(5);
    for (const row of rows) expect(row.count, row.href).toBe(counts![row.href.replace(/\//g, "")]);
    plainExpect(true).toBe(true);
  });
});

plainTest.describe("G8 content is visible with JavaScript off", () => {
  plainTest("the Home page shows every revealed block and image without scripts", async () => {
    const browser = await chromium.launch();
    const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${process.env.E2E_PORT || "4342"}`;
    const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/");
    const hidden = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal], .tk-rv, img.tk-fade-img"));
      return { total: nodes.length, hidden: nodes.filter((node) => getComputedStyle(node).opacity === "0").length };
    });
    plainExpect(hidden.hidden).toBe(0);
    plainExpect(await page.locator("h1").count()).toBeGreaterThan(0);
    await browser.close();
  });
});
