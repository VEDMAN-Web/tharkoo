import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import { expect, test, withLocalDb } from "./helpers";

const SHOTS = process.env.A13_SHOTS_DIR || "";
const MARKER = " (from the layout)";
const HOME = ".tkh-home";

const squash = (text: string) => text.replace(/\s+/g, " ").trim();

async function homeText(page: Page) {
  await page.goto("/");
  await expect(page.locator(HOME)).toBeVisible();
  return { text: squash(await page.locator(HOME).innerText()), h1: squash(await page.getByRole("heading", { level: 1 }).first().innerText()), h1Count: await page.getByRole("heading", { level: 1 }).count() };
}

async function shoot(page: Page, state: "flag-off" | "flag-on") {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  for (const [width, height] of [[1440, 900], [390, 844]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(page.locator(HOME)).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/home-${state}-${width}x${height}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

async function setFlag(on: boolean) {
  await withLocalDb((db) => db.collection("sites").updateOne({ key: "default" }, { $set: { homeFromLayout: on } }, { upsert: true }));
}

async function stepsTitle(next?: string) {
  const result = await withLocalDb(async (db) => {
    const doc = await db.collection("page_layouts").findOne({ key: "home", scope: "default" });
    const blocks = (doc?.published ?? []) as { type: string; props: { title?: string } }[];
    const steps = blocks.find((block) => block.type === "homeSteps");
    if (!steps) return null;
    const before = steps.props.title ?? "";
    if (next !== undefined) {
      steps.props.title = next;
      await db.collection("page_layouts").updateOne({ key: "home", scope: "default" }, { $set: { published: blocks } });
    }
    return before;
  });
  return result;
}

function runD1(args: string[]) {
  const file = resolve(process.env.E2E_MONGO_URI_FILE || ".shots/e2e/mongo-uri.txt");
  const uri = readFileSync(file, "utf8").trim();
  const run = spawnSync("npx", ["tsx", "scripts/migrate/d1-home-layout.ts", ...args, "--json"], { env: { ...process.env, MONGODB_URI: uri }, shell: true, encoding: "utf8", timeout: 120_000 });
  const lines = (run.stdout || "").split("\n").map((line) => line.trim()).filter((line) => line.startsWith("{"));
  return { status: run.status, stderr: run.stderr || "", result: lines.length ? (JSON.parse(lines[lines.length - 1]) as { action: string; toVersion: number; blocks: { type: string }[] }) : null };
}

test.describe("A13 home from layout", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("the layout path shows the same text and H1 as today's home, and the switch turns it off again", async ({ page }) => {
    test.setTimeout(900_000);
    await setFlag(false);
    const base = await homeText(page);
    expect(base.h1Count).toBe(1);
    await shoot(page, "flag-off");

    const dry = runD1(["--dry-run"]);
    expect(dry.status, dry.stderr).toBe(0);
    expect(["dry-run", "unchanged", "refused"]).toContain(dry.result?.action);
    const apply = runD1(["--apply", "--yes"]);
    expect(apply.status, apply.stderr).toBe(0);
    expect(["applied", "unchanged"]).toContain(apply.result?.action);
    expect(apply.result?.blocks.map((block) => block.type)).toEqual(["homeBanner", "homeTrust", "homeCategories", "homeAds", "homeSteps"]);
    const refused = runD1(["--apply"]);
    expect(refused.status).toBe(1);
    expect(refused.stderr).toContain("--apply needs --yes");

    const original = await stepsTitle();
    expect(original, "the format 2 home has a How it works block").toBeTruthy();
    await stepsTitle(`${original}${MARKER}`);
    await setFlag(true);
    await expect
      .poll(async () => (await homeText(page)).text.includes(MARKER), { timeout: 240_000, intervals: [5_000], message: "the home page draws the layout once the switch is on" })
      .toBe(true);
    const on = await homeText(page);
    expect(on.h1).toBe(base.h1);
    expect(on.h1Count).toBe(1);
    expect(on.text.replace(MARKER, "")).toBe(base.text);
    await shoot(page, "flag-on");

    await setFlag(false);
    await expect
      .poll(async () => (await homeText(page)).text.includes(MARKER), { timeout: 240_000, intervals: [5_000], message: "the home page goes back to today's page when the switch is off" })
      .toBe(false);
    const off = await homeText(page);
    expect(off.text).toBe(base.text);
    expect(off.h1).toBe(base.h1);
    await stepsTitle(original as string);
  });
});
