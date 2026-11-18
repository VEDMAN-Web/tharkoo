import { expect, signInAdminContext, test } from "./helpers";

/**
 * H10.5c-a: "Undo on Settings puts the old value back in the box" failed now and then (h7-164 d). The change WAS undone
 * in the database, but the box kept showing the new value: the form was rebuilt from whichever page refresh the browser
 * applied last, and an Undo clicked right after a save (a few milliseconds after the save answered) could lose that race.
 * The form now keeps its own saved values. This clicks Undo the moment the toast appears, many times over; before the
 * fix about one round in eight left the new value in the box.
 */
const ROUNDS = 15;

test.describe("H10.5c-a Settings Undo", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test(`Undo clicked at once after a save puts the old value back, ${ROUNDS} times in a row`, async ({ browser, baseURL }) => {
    test.setTimeout(240_000);
    const staff = await browser.newContext({ baseURL });
    const page = await staff.newPage();
    await signInAdminContext(staff, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    const undo = page.locator("[data-tk=undo-windows]");
    const box = undo.getByLabel("Ad edits");
    for (let round = 1; round <= ROUNDS; round += 1) {
      await page.goto("/admin/settings/");
      const before = await box.inputValue();
      const changed = before === "45" ? "46" : "45";
      await box.fill(changed);
      await undo.getByRole("button", { name: "Save undo windows" }).click();
      await expect(page.locator("[data-tk=toast]")).toContainText("Undo windows saved.");
      await page.locator("[data-tk=toast] [data-tk=toast-undo]").click();
      await expect(page.locator("[data-tk=toast]")).toContainText("Change undone.");
      await expect(box, `round ${round}: the box goes back to ${before}`).toHaveValue(before, { timeout: 8_000 });
      // The save and Undo buttons are gone again, and a reload shows the same value: the database agrees.
      await expect(undo.getByRole("button", { name: "Save undo windows" })).toHaveCount(0);
      await page.reload();
      await expect(box).toHaveValue(before);
    }
  });
});
