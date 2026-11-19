import { expect, hasHorizontalScroll, loginUi, newUserApi, test } from "./helpers";

/**
 * H15.5 (E1-B5): saving a search on the Alerts page. The old code read `event.currentTarget` after waiting for the server, when it is
 * already gone, so saving ended in a script error ("null is not an object (reading reset)") and the form was never cleared. Now the form is
 * cleared, no error is thrown, and the list shows the new alert without a page reload. Remove updates the list the same way.
 */
test.describe("H15.5 saved search alerts", () => {
  test("Save search clears the form, throws no script error, and the list shows the alert without a reload; Remove updates it", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const problems: string[] = [];
    page.on("pageerror", (error) => problems.push(`pageerror: ${error.message.slice(0, 160)}`));
    page.on("console", (message) => {
      if (message.type() === "error") problems.push(`console: ${message.text().slice(0, 160)}`);
    });
    const user = await newUserApi(baseURL!, "h155alerts");
    await loginUi(page, user.email, undefined, "/u/account/alerts/");
    await expect(page.getByRole("heading", { level: 1, name: "Your alerts" })).toBeVisible();
    await expect(page.getByText("No saved searches yet")).toBeVisible();
    let reloads = 0;
    page.on("load", () => (reloads += 1));
    const baseline = reloads;

    const words = `h155 words ${Date.now()}`;
    const form = page.locator('section[aria-labelledby="alerts-new"] form');
    await form.getByLabel("Words").fill(words);
    await form.getByLabel("Category").selectOption({ index: 1 });
    await form.getByRole("button", { name: "Save search" }).click();

    await expect(page.getByText("Alert saved. We will email you when a new ad matches.")).toBeVisible();
    expect(problems, "no script error while saving").toEqual([]);
    await expect(form.getByLabel("Words"), "the form is cleared").toHaveValue("");
    await expect(form.getByLabel("Category")).toHaveValue("");
    const list = page.locator('section[aria-labelledby="alerts-list"]');
    await expect(list.getByText(`"${words}"`)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("No saved searches yet")).toHaveCount(0);
    expect(reloads - baseline, "the list changed without a full page reload").toBe(0);
    expect(await hasHorizontalScroll(page)).toBe(false);

    await list.getByRole("button", { name: /^Remove alert/ }).first().click();
    await expect(page.getByText("Alert removed.")).toBeVisible();
    await expect(page.getByText("No saved searches yet")).toBeVisible({ timeout: 15_000 });
    expect(problems, "no script error while removing").toEqual([]);
    await user.api.dispose();
  });
});
