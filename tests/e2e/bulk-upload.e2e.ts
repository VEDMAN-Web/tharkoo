import { expect, hasHorizontalScroll, PNG, newUserApi, signInAdminContext, test, withLocalDb } from "./helpers";

/** Gives a registered account what a partner import needs: ID verified, an adult, and an approved status. */
async function approvePartner(email: string) {
  const result = await withLocalDb((db) =>
    db.collection("users").updateOne(
      { email: email.toLowerCase() },
      { $set: { verificationStatus: "approved", attestedAdultAt: new Date("2020-01-01"), dateOfBirth: new Date("1990-04-02") } },
    ),
  );
  return result !== null && result.matchedCount === 1;
}

test.describe("H6.12 bulk upload", () => {
  test("uploads ten images in one batch, with alt text from the file names", async ({ page, context, baseURL }) => {
    await signInAdminContext(context, baseURL!);
    await page.goto("/admin/media/");
    const input = page.locator('input[type="file"][multiple][accept*="image/jpeg"]').first();
    const images = Array.from({ length: 10 }, (_, index) => ({
      name: `red-sofa_${String(index + 1).padStart(2, "0")}.png`,
      mimeType: "image/png",
      buffer: PNG,
    }));
    await input.setInputFiles(images);
    await page.getByRole("button", { name: "Upload 10 images" }).click();
    await expect(page.getByText("10 uploaded, 0 failed, 0 waiting")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Auto alt, check it").first()).toBeVisible();
    await expect(page.getByText("· Missing alt")).toHaveCount(0);
    await expect(page.locator("h1")).toHaveCount(1);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("refuses a file that is not an image, without sending it", async ({ page, context, baseURL }) => {
    await signInAdminContext(context, baseURL!);
    await page.goto("/admin/media/");
    const input = page.locator('input[type="file"][multiple][accept*="image/jpeg"]').first();
    await input.setInputFiles([{ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not a picture") }]);
    await expect(page.getByText("Only jpeg, png or webp images")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Upload/ })).toBeDisabled();
  });

  test("checks a CSV with 5 ads and 12 photos, then imports it as pending", async ({ page, context, baseURL }) => {
    const { api, email } = await newUserApi(baseURL!, "partner-import");
    await api.dispose();
    expect(await approvePartner(email)).toBe(true);
    await signInAdminContext(context, baseURL!);
    await page.goto("/admin/import/");

    const stamp = Date.now().toString(36);
    const ads = [
      ["Office assistant one", "a1-a.png|a1-b.png|a1-c.png"],
      ["Office assistant two", "a2-a.png|a2-b.png"],
      ["Office assistant three", "a3-a.png|a3-b.png|a3-c.png"],
      ["Office assistant four", "a4-a.png|a4-b.png"],
      ["Office assistant five", "a5-a.png|a5-b.png"],
    ];
    const csv = [
      "category,city,title,description,role,photos",
      ...ads.map(([title, photos]) => `jobs,mumbai,${title} ${stamp},A weekday office role with a clear description,Office assistant,${photos}`),
    ].join("\n");
    const names = ads.flatMap(([, photos]) => photos.split("|"));
    expect(names).toHaveLength(12);

    await page.getByLabel("Partner account email").fill(email);
    await page.locator("#import-file").setInputFiles({ name: "ads.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await page.locator("#import-images").setInputFiles(names.map((name) => ({ name, mimeType: "image/png", buffer: PNG })));
    await page.getByRole("button", { name: "Step 1: check the file (dry run)" }).click();
    await expect(page.getByText(/5 ads ready/)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/12 photos to attach, 12 images to upload/)).toBeVisible();

    await page.getByRole("button", { name: /Step 2: import 5 listings as pending/ }).click();
    await expect(page.getByRole("heading", { name: "Import finished" })).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText("5 of 5 rows done. 5 imported, 0 failed while saving.")).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
    await expect(page.locator("h1")).toHaveCount(1);
  });

  test("downloads the import template with every base column", async ({ context, baseURL }) => {
    await signInAdminContext(context, baseURL!);
    const res = await context.request.get(`${baseURL}/admin/import/template/`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-disposition"]).toContain("tharkoo-import-template.csv");
    expect((await res.text()).split(/\r?\n/)[0]).toBe("category,subcategory,city,district,title,description,price,photos");
  });
});
