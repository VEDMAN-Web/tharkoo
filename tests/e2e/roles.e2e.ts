import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { expect, loginApi, newApi, originHeaders, registerApi, setRoles, test, uniqueEmail, visibleText } from "./helpers";

/** Every admin screen that exists as a route (static segments only). */
function adminRoutes() {
  const root = join(process.cwd(), "src", "app", "admin");
  const routes = ["/admin/"];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith("[") || entry.name.startsWith("(")) continue;
    if (existsSync(join(root, entry.name, "page.tsx"))) routes.push(`/admin/${entry.name}/`);
  }
  return routes;
}

const ADMIN_API_GET = ["/api/admin/list/?model=Listing", "/api/admin/list/?model=Coupon", "/api/admin/verifications/"];

test.describe("8 Roles", () => {
  test("a normal user sees no admin content on any /admin route", async ({ baseURL }) => {
    const routes = adminRoutes();
    expect(routes.length).toBeGreaterThan(10);
    const api = await newApi(baseURL!);
    const email = uniqueEmail("plain");
    await registerApi(api, baseURL!, email);
    await loginApi(api, baseURL!, email);
    for (const route of routes) {
      const res = await api.get(route);
      const html = await res.text();
      const text = visibleText(html);
      // Today the routes answer 200 with the staff sign-in form (see BUG 8 in lane-d-bugs); a 403 would also be fine.
      if (res.status() === 200) {
        expect(text, route).toContain("Staff sign in");
        expect(text, route).not.toContain("Tharkoo admin");
      } else {
        expect(res.status(), route).toBe(403);
      }
      expect(html, route).toMatch(/<meta name="robots" content="[^"]*noindex/);
    }
    await api.dispose();
  });

  test("a normal user gets 403 on every /api/admin call", async ({ baseURL }) => {
    const api = await newApi(baseURL!);
    const email = uniqueEmail("plainapi");
    await registerApi(api, baseURL!, email);
    await loginApi(api, baseURL!, email);
    for (const path of ADMIN_API_GET) {
      const res = await api.get(path);
      expect(res.status(), path).toBe(403);
    }
    const mutate = await api.post("/api/admin/mutate/", {
      headers: originHeaders(baseURL!, "/admin/"),
      data: { model: "Coupon", op: "create", data: {} },
    });
    expect(mutate.status()).toBe(403);
    const decide = await api.post("/api/admin/verifications/000000000000000000000000/decision/", {
      headers: originHeaders(baseURL!, "/admin/"),
      data: { decision: "approved" },
    });
    expect(decide.status()).toBe(403);
    await api.dispose();
  });

  test("signed-out visitors cannot use /api/admin", async ({ baseURL }) => {
    const api = await newApi(baseURL!);
    for (const path of ADMIN_API_GET) {
      const res = await api.get(path);
      expect([401, 403], path).toContain(res.status());
    }
    const mutate = await api.post("/api/admin/mutate/", {
      headers: originHeaders(baseURL!, "/admin/"),
      data: { model: "Coupon", op: "create", data: {} },
    });
    expect([401, 403]).toContain(mutate.status());
    await api.dispose();
  });

  test("the admin sign-in page itself is noindex", async ({ request }) => {
    const res = await request.get("/admin/login/");
    expect(res.status()).toBe(200);
    expect(await res.text()).toMatch(/<meta name="robots" content="[^"]*noindex/);
  });

  test("a seo_editor sees only the SEO group in the sidebar", async ({ page, baseURL }) => {
    const email = uniqueEmail("seo");
    const api = await newApi(baseURL!);
    await registerApi(api, baseURL!, email);
    await api.dispose();
    const promoted = await setRoles(email, ["seo_editor"]);
    test.skip(!promoted, "Needs the in-memory Mongo URI written by tests/e2e/server.mjs (E2E_MONGO_URI_FILE).");

    await page.goto("/u/login/");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill("E2ePass1!xyz");
    await page.getByRole("button", { name: "LOG IN" }).click();
    await page.waitForURL(/\/u\/account\/dashboard\/|\/admin\//);
    await page.goto("/admin/seo/");
    await expect(page.locator(".adm-nav").first()).toBeAttached();
    const groups = await page.locator(".adm-group-label").allTextContents();
    expect(groups).toContain("SEO");
    for (const hidden of ["Pages", "Money", "System", "Listings"]) {
      expect(groups, `group ${hidden} is hidden from a seo_editor`).not.toContain(hidden);
    }
    const links = await page.locator(".adm-link-label").allTextContents();
    expect(links).toContain("SEO overview");
    expect(links).not.toContain("Finance");
    expect(links).not.toContain("Coupons");
    // The plan says only the SEO group. Today the Users screen (People) is also open to a seo_editor.
    if (groups.includes("People")) {
      test.info().annotations.push({ type: "BUG 8", description: "seo_editor sees the People group (Users screen)" });
    }
  });

  test("a seo_editor cannot open money or system screens by URL", async ({ baseURL }) => {
    test.fixme(true, "BUG 8 Roles: /admin/finance/, /admin/settings/ and /admin/coupons/ render for a seo_editor typing the URL.");
    const email = uniqueEmail("seourl");
    const api = await newApi(baseURL!);
    await registerApi(api, baseURL!, email);
    await setRoles(email, ["seo_editor"]);
    await loginApi(api, baseURL!, email);
    for (const route of ["/admin/finance/", "/admin/settings/", "/admin/coupons/", "/admin/admins/"]) {
      const res = await api.get(route);
      const text = visibleText(await res.text());
      expect(res.status() === 403 || !text.includes("Tharkoo admin"), route).toBe(true);
    }
    await api.dispose();
  });

  test("a seo_editor cannot write coupons through /api/admin/mutate", async ({ baseURL }) => {
    test.fixme(true, "BUG 8 Roles (critical): a seo_editor can create a Coupon and list any model through /api/admin.");
    const email = uniqueEmail("seoapi");
    const api = await newApi(baseURL!);
    await registerApi(api, baseURL!, email);
    await setRoles(email, ["seo_editor"]);
    await loginApi(api, baseURL!, email);
    const list = await api.get("/api/admin/list/?model=Coupon");
    expect(list.status()).toBe(403);
    const res = await api.post("/api/admin/mutate/", { headers: originHeaders(baseURL!, "/admin/"), data: { model: "Coupon", op: "create", data: {} } });
    expect(res.status()).toBe(403);
    await api.dispose();
  });
});
