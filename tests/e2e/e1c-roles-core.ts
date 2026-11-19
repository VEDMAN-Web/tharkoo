import type { Page } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD, expect, loginUi, newApi, registerApi, setRoles, test, uniqueEmail } from "./helpers";
import { pageProblems, watchConsole } from "./e1c-checks";

/** E1-C: each staff role sees ONLY its own screens, at 1440 and at 390. Every screen it sees opens; every other admin screen is closed (403). */

async function sidebarHrefs(page: Page): Promise<string[]> {
  await page.goto("/admin/", { waitUntil: "networkidle" });
  await expect(page.locator("h1").first()).toBeVisible();
  const phone = (page.viewportSize()?.width ?? 1440) < 900;
  const links = page.locator(".adm-nav .adm-link:visible");
  if (phone) await expect(async () => {
    await page.getByRole("button", { name: "Menu" }).first().click();
    await expect(links.first()).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await expect(links.first()).toBeVisible();
  return links.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href") ?? "").filter(Boolean));
}

const everythingBySize = new Map<number, string[]>();

export function superadminTest() {
  test("superadmin sees every screen and each one opens", async ({ page }) => {
    test.setTimeout(420_000);
    const errors = watchConsole(page);
    await loginUi(page, ADMIN_EMAIL, ADMIN_PASSWORD, "/admin/");
    const hrefs = await sidebarHrefs(page);
    everythingBySize.set(page.viewportSize()?.width ?? 1440, hrefs);
    expect(hrefs.length).toBeGreaterThanOrEqual(19);
    const problems: string[] = [];
    for (const href of hrefs) {
      const response = await page.goto(href); await page.waitForTimeout(800);
      if (response?.status() !== 200) problems.push(`${href}: status ${response?.status()}`);
      else problems.push(...(await pageProblems(page, href)));
    }
    expect(problems, "every superadmin screen opens and is healthy").toEqual([]);
    expect(errors, "no console errors").toEqual([]);
  });
}

export function roleTests(roles: string[]) {
  for (const role of roles) {
    test(`${role}: every screen in its menu opens, every other admin screen is closed`, async ({ page, baseURL, browser }) => {
      test.setTimeout(420_000);
      const size = page.viewportSize() ?? { width: 1440, height: 900 };
      let everything = everythingBySize.get(size.width);
      if (!everything) {
        const superContext = await browser.newContext({ baseURL, viewport: size });
        const superPage = await superContext.newPage();
        await loginUi(superPage, ADMIN_EMAIL, ADMIN_PASSWORD, "/admin/");
        everything = await sidebarHrefs(superPage);
        everythingBySize.set(size.width, everything);
        await superContext.close();
      }

      const email = uniqueEmail(`e1c${role}`);
      const api = await newApi(baseURL!);
      await registerApi(api, baseURL!, email);
      await api.dispose();
      expect(await setRoles(email, [role])).toBe(true);
      const errors = watchConsole(page);
      await loginUi(page, email, undefined, "/admin/");
      const own = await sidebarHrefs(page);
      expect(own.length, `${role} has a menu`).toBeGreaterThan(0);
      for (const href of own) expect(everything, `${role} menu link ${href}`).toContain(href);
      expect(own.length, `${role} sees fewer screens than the superadmin`).toBeLessThan(everything.length);

      const problems: string[] = [];
      for (const href of own) {
        const response = await page.goto(href); await page.waitForTimeout(800);
        if (response?.status() !== 200) problems.push(`${role} menu link ${href}: status ${response?.status()}`);
        else problems.push(...(await pageProblems(page, `${role} ${href}`, false)));
      }
      for (const href of everything.filter((item) => !own.includes(item))) {
        const response = await page.goto(href);
        if (response?.status() !== 403) problems.push(`${role} on closed ${href}: status ${response?.status()}, expected 403`);
      }
      expect(problems, `${role}: menu and permissions agree`).toEqual([]);
      expect(errors, "no console errors").toEqual([]);
    });
  }
}
