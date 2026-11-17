import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, test, withLocalDb } from "./helpers";

const SHOTS = process.env.A32_SHOTS_DIR || "";
const CACHE_WAIT_MS = 65_000;

async function serious(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`);
}

function runD3(args: string[]) {
  const uri = readFileSync(resolve(process.env.E2E_MONGO_URI_FILE || ".shots/e2e/mongo-uri.txt"), "utf8").trim();
  const run = spawnSync("npx", ["tsx", "scripts/migrate/d3-listing-copy.ts", ...args, "--json"], { env: { ...process.env, MONGODB_URI: uri }, shell: true, encoding: "utf8", timeout: 120_000 });
  const lines = (run.stdout || "").split("\n").map((line) => line.trim()).filter((line) => line.startsWith("{"));
  return { status: run.status, stderr: run.stderr || "", out: lines.length ? (JSON.parse(lines[lines.length - 1]) as { mode: string; written?: number; plan: { totals: { urls: number; new: number }; entries: { path: string; status: string }[] } }) : null };
}

test.describe("A32 listing pages read their copy from the content editor", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("D3 copies the old text, the switch 'content' shows it (with an editor change winning), and /education/ and /education/surat/ look right", async ({ page }) => {
    test.setTimeout(600_000);
    await withLocalDb(async (db) => {
      await db.collection("url_overrides").deleteMany({ path: "/education/" });
      await db.collection("url_overrides").insertOne({ path: "/education/", h1: "A32 override heading", intro: "A32 override intro text.", faq: [{ q: "A32 question?", a: "A32 answer." }], createdAt: new Date(), updatedAt: new Date() });
      await db.collection("sites").updateOne({ key: "default" }, { $set: { landings: { "education|surat": { intro: "A32 landing intro for Surat." } } } }, { upsert: true });
    });

    const dry = runD3(["--dry-run"]);
    expect(dry.status, dry.stderr).toBe(0);
    expect(dry.out?.mode).toBe("dry-run");
    expect(dry.out?.plan.entries.map((entry) => `${entry.path}:${entry.status}`)).toEqual(["/education/:new", "/education/surat/:new"]);
    const refused = runD3(["--apply"]);
    expect(refused.status).toBe(1);
    expect(refused.stderr).toContain("--apply needs --yes");
    const applied = runD3(["--apply", "--yes"]);
    expect(applied.status, applied.stderr).toBe(0);
    expect(applied.out?.written).toBe(2);
    expect(runD3(["--apply", "--yes"]).out?.written).toBe(0);

    await withLocalDb(async (db) => {
      await db.collection("content_items").updateOne({ path: "/education/" }, { $set: { "published.h1": "A32 content heading" } });
      await db.collection("sites").updateOne({ key: "default" }, { $set: { listingCopySource: "content" } });
    });
    await page.waitForTimeout(CACHE_WAIT_MS);

    await page.setViewportSize({ width: 1440, height: 900 });
    // The site record is cached and refreshed in the background (stale-while-revalidate): the first visit may still show the old words.
    await expect(async () => {
      await page.goto("/education/");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("A32 content heading", { timeout: 2_000 });
    }).toPass({ timeout: 120_000, intervals: [4_000] });
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByText("A32 override intro text.").first()).toBeAttached();
    await expect(page.getByText("A32 question?").first()).toBeAttached();
    expect(await hasHorizontalScroll(page)).toBe(false);
    expect(await serious(page)).toEqual([]);
    if (SHOTS) {
      mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({ path: `${SHOTS}/education-1440x900.png` });
    }

    await page.goto("/education/surat/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Education in Surat/i);
    await expect(page.getByText("A32 landing intro for Surat.").first()).toBeAttached();
    expect(await hasHorizontalScroll(page)).toBe(false);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/education-surat-1440x900.png` });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/education/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("A32 content heading");
    expect(await hasHorizontalScroll(page)).toBe(false);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/education-390x844.png` });
    await page.goto("/education/surat/");
    expect(await hasHorizontalScroll(page)).toBe(false);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/education-surat-390x844.png` });
    await withLocalDb((db) => db.collection("sites").updateOne({ key: "default" }, { $set: { listingCopySource: "legacy" } }));
  });
});
