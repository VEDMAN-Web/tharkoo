import { adminApi, expect, test } from "./helpers";

const GONE = ["templates", "translations", "analytics", "media-review", "packs", "products", "slots", "admins", "audit"];

test("A12: the nine dead JSON screens answer 404 inside the admin", async ({ baseURL }) => {
  const api = await adminApi(baseURL!);
  for (const name of GONE) {
    const res = await api.get(`/admin/${name}/`);
    expect(res.status(), name).toBe(404);
  }
  const kept = await api.get("/admin/listings/");
  expect(kept.status()).toBe(200);
  await api.dispose();
});
