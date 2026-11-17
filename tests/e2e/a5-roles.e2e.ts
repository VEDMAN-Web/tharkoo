import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD, expect, hasHorizontalScroll, loginUi, newApi, registerApi, setRoles, test, uniqueEmail } from "./helpers";

const SHOTS = process.env.A5_SHOTS_DIR || "";

const EXPECTED: Record<string, { labels: string[]; closed: string[] }> = {
  moderator: {
    labels: ["Dashboard", "History & undo", "Ads to review", "Reports", "ID checks", "All ads", "Users"],
    closed: ["/admin/prices/", "/admin/page-builder/", "/admin/content/", "/admin/team/", "/admin/settings/", "/admin/seo/"],
  },
  blog_editor: {
    labels: ["Dashboard", "History & undo", "Content studio", "Media library"],
    closed: ["/admin/moderation/", "/admin/reports/", "/admin/users/", "/admin/prices/", "/admin/seo/", "/admin/settings/", "/admin/team/"],
  },
  content_editor: {
    labels: ["Dashboard", "History & undo", "Page builder", "Content studio", "Media library", "Menus & site text", "Categories & fields", "Cities & areas"],
    closed: ["/admin/moderation/", "/admin/reports/", "/admin/finance/", "/admin/users/", "/admin/prices/", "/admin/support/", "/admin/seo/", "/admin/settings/", "/admin/team/"],
  },
  support: {
    labels: ["Dashboard", "History & undo", "Support desk", "All ads", "Users"],
    closed: ["/admin/moderation/", "/admin/finance/", "/admin/content/", "/admin/page-builder/"],
  },
  finance: {
    labels: ["Dashboard", "History & undo", "Orders & credits", "Prices & plans"],
    closed: ["/admin/moderation/", "/admin/users/", "/admin/content/", "/admin/page-builder/"],
  },
};

async function sidebarLabels(page: Page) {
  return page.locator(".adm-nav .adm-link-label").allTextContents();
}

async function shots(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/");
  await page.screenshot({ path: `${SHOTS}/sidebar-${name}-1440x900.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/");
  await page.getByRole("button", { name: "Menu" }).click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOTS}/sidebar-${name}-390x844.png` });
}

test.describe("A5 screens map: each role sees its own sidebar", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  for (const [role, expected] of Object.entries(EXPECTED)) {
    test(`${role}: only its screens in the sidebar, a 403 elsewhere`, async ({ page, baseURL }) => {
      test.setTimeout(120_000);
      const email = uniqueEmail(`a5${role}`);
      const api = await newApi(baseURL!);
      await registerApi(api, baseURL!, email);
      await api.dispose();
      const promoted = await setRoles(email, [role]);
      test.skip(!promoted, "Needs the in-memory Mongo URI written by tests/e2e/server.mjs (E2E_MONGO_URI_FILE).");
      await loginUi(page, email, undefined, "/admin/");
      await expect(page.locator(".adm-side")).toBeVisible();
      expect(await sidebarLabels(page)).toEqual(expected.labels);
      expect(await hasHorizontalScroll(page)).toBe(false);
      const hrefs = await page.locator(".adm-nav .adm-link").evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
      expect(hrefs).toHaveLength(expected.labels.length);
      for (const route of expected.closed) {
        const response = await page.goto(route);
        expect(response?.status(), `${role} on ${route}`).toBe(403);
      }
      for (const href of hrefs) {
        const response = await page.goto(href);
        expect(response?.status(), `${role} on ${href}`).not.toBe(403);
      }
      await shots(page, role);
    });
  }

  test("superadmin sees all 19 screens in 7 groups, and the new screens answer", async ({ page }) => {
    test.setTimeout(120_000);
    await loginUi(page, ADMIN_EMAIL, ADMIN_PASSWORD, "/admin/");
    await expect(page.locator(".adm-side")).toBeVisible();
    expect(await sidebarLabels(page)).toHaveLength(19);
    expect(await page.locator(".adm-nav .adm-group-label").allTextContents()).toEqual(["Today", "Queues", "Ads & people", "Money", "Website", "Catalogue", "System"]);
    for (const route of ["/admin/history/", "/admin/prices/", "/admin/page-builder/", "/admin/content/", "/admin/team/", "/admin/ads/"]) {
      const answer = await page.goto(route);
      expect(answer?.status(), route).toBe(200);
      await expect(page.locator("h1")).toHaveCount(1);
    }
    await shots(page, "superadmin");
  });
});
