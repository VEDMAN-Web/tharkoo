import { adminApi, expect, loginApi, newApi, registerApi, setRoles, test, uniqueEmail } from "./helpers";

function h1Count(html: string) {
  return (html.match(/<h1[\s>]/g) || []).length;
}

test.describe("H7.133 finance screen", () => {
  test("a finance account opens /admin/finance/ with 200 and one h1", async ({ baseURL }) => {
    const email = uniqueEmail("finance");
    const api = await newApi(baseURL!);
    await registerApi(api, baseURL!, email);
    const promoted = await setRoles(email, ["finance"]);
    test.skip(!promoted, "Needs the in-memory Mongo URI written by tests/e2e/server.mjs (E2E_MONGO_URI_FILE).");
    await loginApi(api, baseURL!, email);
    const res = await api.get("/admin/finance/");
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(h1Count(html)).toBe(1);
    expect(html).toContain("Refunds to handle by hand");
    await api.dispose();
  });

  test("an admin opens /admin/finance/ with 200 and one h1", async ({ baseURL }) => {
    const api = await adminApi(baseURL!);
    const res = await api.get("/admin/finance/");
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(h1Count(html)).toBe(1);
    expect(html).toContain("Refunds to handle by hand");
    await api.dispose();
  });
});
