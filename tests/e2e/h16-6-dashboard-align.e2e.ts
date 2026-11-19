import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { ObjectId } from "mongodb";
import { expect, hasHorizontalScroll, test, withLocalDb, withoutAddress } from "./helpers";
import { createLiveAd } from "./flows";

/**
 * H16.6: the whole seller dashboard, from the left menu to the last card, is aligned: same tops, one gap between sections,
 * numbers centred in their rows, equal heights. It measures the page at 1440, 768 and 390 and writes full-page shots when
 * H166_SHOTS names a folder.
 */

const DAY = 86_400_000;
const SHOTS = process.env.H166_SHOTS ?? "";
const PREFIX = process.env.H166_PREFIX ?? "after";

let counter = 0;
async function seedEvents(listingId: string, type: "view" | "click", daysAgo: number, count: number) {
  const rows = Array.from({ length: count }, () => ({
    listingId: new ObjectId(listingId),
    type,
    visitorKey: `h166-${Date.now()}-${(counter += 1)}`,
    createdAt: new Date(Date.now() - daysAgo * DAY - (daysAgo === 0 ? 2 * 60_000 : 0) + counter),
  }));
  if (rows.length) await withLocalDb((db) => db.collection("ad_events").insertMany(rows));
}

async function shot(page: Page) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${PREFIX}-${page.viewportSize()?.width}.png`, fullPage: true });
}

type Box = { top: number; bottom: number; left: number; right: number; height: number; width: number; mid: number };

/** Everything the checks need, read from the page in one go. */
async function measure(page: Page) {
  return page.evaluate(() => {
    const box = (el: Element | null): Box | null => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top + scrollY, bottom: r.bottom + scrollY, left: r.left, right: r.right, height: r.height, width: r.width, mid: r.top + scrollY + r.height / 2 };
    };
    const all = (selector: string, root: ParentNode = document) => [...root.querySelectorAll(selector)].filter((el) => el.getClientRects().length > 0);
    const q = (selector: string, root: ParentNode = document) => all(selector, root)[0] ?? null;
    const tiles = all('[data-tk="dash-tiles"] .up-dash-kpi').map((tile) => ({
      label: box(q(".up-dash-kpi-label", tile)),
      value: box(q(".up-dash-kpi-value", tile)),
      spark: box(q(".up-dash-spark", tile)),
      note: box(q(".up-dash-kpi-note", tile)),
      card: box(tile),
    }));
    const columns = all('[data-tk="chart-day"]').map((col) => ({ label: box(q(".up-dash-col-value", col)), bar: box(q(".up-dash-bar-views", col)), baseline: box(q(".up-dash-bars", col)) }));
    const main = q(".up-main");
    const sections = main ? [...main.children].flatMap((child) => (child.classList.contains("up-dash") ? [...child.children] : [child])).filter((el) => el.getClientRects().length > 0 && !(el instanceof HTMLElement && el.dataset.tk === "presence")) : [];
    const sectionBoxes = sections.map((el) => ({ name: el.getAttribute("data-tk") || el.className.toString().slice(0, 30), ...box(el)! })).filter((row) => row.height > 4);
    const adRows = all('[data-tk="dash-ad"]').map((row) => ({
      row: box(row),
      thumb: box(q(".up-dash-thumb", row)),
      nums: all(".up-dash-num", row).map((el) => box(el)),
      rank: box(q(".up-dash-rank", row)),
      buttons: all(".up-dash-btn", row).map((el) => box(el)),
    }));
    const adHead = all(".up-dash-adhead > span").map((el) => box(el));
    const rowCells = adRows.length ? all('[data-tk="dash-ad"]')[0] : null;
    const firstCells = rowCells ? [...rowCells.children].map((el) => box(el)) : [];
    const heads = all(".up-card-head, .up-dash-chart-head, .up-dash-ads-head, .up-dash-goal-head").map((head) => ({ h2: box(q("h2", head)), link: box(q("a, button", head)) }));
    const goal = {
      ring: box(q(".up-dash-ring")),
      text: box(q(".up-dash-goal-text")),
      chips: all('[data-tk="milestone"]').map((el) => box(el)),
    };
    const packs = all(".up-pack").map((el) => box(el));
    return {
      nav: box(q(".up-nav")),
      navHead: box(q(".up-nav-head, .up-nav-list")),
      head: box(q(".up-dash-head")),
      tiles,
      columns,
      chartTitle: box(q('[data-tk="dash-chart"] .up-dash-h2')),
      liftKicker: box(q(".up-dash-lift-kicker")),
      chartCard: box(q('[data-tk="dash-chart"]')),
      liftCard: box(q('[data-tk="dash-lift"]')),
      sections: sectionBoxes,
      adRows,
      adHead,
      firstCells,
      heads,
      goal,
      packs,
      sparkHeights: all(".up-dash-spark").map((el) => Math.round(el.getBoundingClientRect().height)),
    };
  });
}

type M = Awaited<ReturnType<typeof measure>>;
const spread = (values: number[]) => (values.length ? Math.max(...values) - Math.min(...values) : 0);

function checkTiles(m: M, phone: boolean) {
  expect.soft(m.tiles, "three tiles").toHaveLength(3);
  expect.soft(spread(m.tiles.map((t) => t.label!.top)), "tile labels on one line").toBeLessThanOrEqual(1);
  expect.soft(spread(m.tiles.map((t) => t.value!.top)), "tile numbers on one line").toBeLessThanOrEqual(1);
  expect.soft(spread(m.tiles.map((t) => t.spark!.bottom)), "tile spark bottoms on one line").toBeLessThanOrEqual(1);
  expect.soft(spread(m.sparkHeights), "all three sparks have the same height box").toBe(0);
  expect.soft(spread(m.tiles.map((t) => t.card!.height)), "tiles are equally tall").toBeLessThanOrEqual(1);
  if (!phone) expect.soft(spread(m.tiles.map((t) => t.note!.top)), "tile notes on one line").toBeLessThanOrEqual(1);
}

function checkChart(m: M, phone: boolean) {
  expect.soft(m.columns.length, "seven days").toBe(7);
  for (const col of m.columns) {
    const gap = col.bar!.top - col.label!.bottom;
    expect.soft(gap, "the value sits just above its own bar").toBeGreaterThanOrEqual(-1);
    expect.soft(gap, "the value sits within 8 px above its bar").toBeLessThanOrEqual(8);
  }
  if (phone) return;
  expect.soft(Math.abs(m.chartTitle!.mid - m.liftKicker!.mid), "chart title and TOP eyebrow on one line").toBeLessThanOrEqual(2);
  expect.soft(Math.abs(m.chartCard!.height - m.liftCard!.height), "the chart card and the TOP card are equally tall").toBeLessThanOrEqual(1);
}

function checkPage(m: M, phone: boolean) {
  if (!phone) expect.soft(Math.abs(m.nav!.top - m.head!.top), "the menu card and the page header start on one line").toBeLessThanOrEqual(2);
  const gaps = m.sections.slice(1).map((row, index) => row.top - m.sections[index].bottom);
  expect.soft(spread(gaps), `one gap between every section (${gaps.map((g) => Math.round(g)).join(", ")})`).toBeLessThanOrEqual(2);
  for (const head of m.heads) {
    if (head.h2 && head.link) expect.soft(Math.abs(head.h2.mid - head.link.mid), "a card heading and its link share one centre line").toBeLessThanOrEqual(3);
  }
}

function checkAds(m: M, phone: boolean) {
  expect.soft(m.adRows.length, "three ads").toBe(3);
  expect.soft(spread(m.adRows.map((row) => row.row!.height)), "equal row heights").toBeLessThanOrEqual(2);
  const buttonWidths = m.adRows.flatMap((row) => row.buttons.map((b) => b!.width));
  expect.soft(spread(buttonWidths), "the buttons are the same width").toBeLessThanOrEqual(2);
  if (phone) return;
  for (const row of m.adRows) {
    const centre = row.row!.mid;
    expect.soft(Math.abs(row.thumb!.mid - centre), "thumbnail centred in its row").toBeLessThanOrEqual(2);
    for (const num of row.nums) expect.soft(Math.abs(num!.mid - centre), "numbers centred in their row").toBeLessThanOrEqual(2);
    if (row.rank && row.rank.height > 0) expect.soft(Math.abs(row.rank.mid - centre), "the rank text centred in its row").toBeLessThanOrEqual(2);
    const buttons = row.buttons.map((b) => b!);
    const stack = buttons.length ? (buttons[buttons.length - 1].bottom + buttons[0].top) / 2 : centre;
    expect.soft(Math.abs(stack - centre), "the buttons centred in their row").toBeLessThanOrEqual(2);
  }
  const heads = m.adHead;
  heads.forEach((cell, index) => {
    const under = m.firstCells[index];
    if (cell && under && index > 0) expect.soft(Math.abs(cell.left - under.left), `column header ${index} lines up with its value`).toBeLessThanOrEqual(2);
  });
}

function checkGoal(m: M, phone: boolean) {
  expect.soft(spread(m.goal.chips.map((c) => c!.height)), "milestone chips are equally tall").toBeLessThanOrEqual(1);
  if (phone) return;
  const ring = m.goal.ring!;
  expect.soft(Math.abs(ring.mid - m.goal.text!.mid), "ring and text on one centre line").toBeLessThanOrEqual(2);
  const chips = m.goal.chips.map((c) => c!);
  expect.soft(Math.abs((Math.min(...chips.map((c) => c.top)) + Math.max(...chips.map((c) => c.bottom))) / 2 - ring.mid), "the chips are centred on the ring").toBeLessThanOrEqual(4);
}

function checkPacks(m: M) {
  if (m.packs.length) expect.soft(spread(m.packs.map((p) => p!.height)), "credit pack tiles are equally tall").toBeLessThanOrEqual(1);
}

test.describe("H16.6 seller dashboard alignment", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("the whole dashboard lines up at 1440, 768 and 390", async ({ page, baseURL }) => {
    test.setTimeout(540_000);
    const first = await createLiveAd(page, baseURL!, "align");
    const mine = await withLocalDb(async (db) => {
      const row = await db.collection("listings").findOne({ _id: new ObjectId(first.listingId) });
      const { _id, ...rest } = row!;
      void _id;
      for (const label of ["two", "three"]) {
        const now = new Date(Date.now() + 1000);
        await db.collection("listings").insertOne({ ...withoutAddress(rest), title: `E2E align ${label} ${Date.now()}`, slug: `e2e-align-${label}-${Date.now()}`, createdAt: now, updatedAt: now });
      }
      return db.collection("listings").find({ ownerId: row!.ownerId, status: "active" }).sort({ createdAt: 1 }).toArray();
    });
    const [a, b] = mine!.map((row) => String(row._id));
    await seedEvents(a, "view", 0, 12);
    await seedEvents(a, "view", 1, 8);
    await seedEvents(a, "view", 3, 5);
    await seedEvents(a, "click", 0, 4);
    await seedEvents(a, "click", 3, 2);
    await seedEvents(b, "view", 0, 3);

    for (const size of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await page.goto("/u/account/", { waitUntil: "networkidle" });
      await expect(page.locator('[data-tk="seller-dashboard"]')).toBeVisible();
      await expect(page.locator("h1")).toHaveCount(1);
      expect(await hasHorizontalScroll(page), `no sideways scroll at ${size.width}`).toBe(false);
      await shot(page);
      const phone = size.width < 600;
      const wide = size.width >= 1100;
      const m = await measure(page);
      checkTiles(m, phone);
      checkChart(m, phone || !wide);
      checkPage(m, phone || !wide);
      checkAds(m, phone || !wide);
      checkGoal(m, phone || !wide);
      checkPacks(m);
    }
  });
});
