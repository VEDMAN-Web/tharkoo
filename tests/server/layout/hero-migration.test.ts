import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resolveHero } from "@/lib/layout/hero";
import { convertHeroBlocks, convertHeroLayouts, convertHeroProps } from "@/server/layout/hero-migration";
import { getPublished, validateBlocks } from "@/server/layout/service";
import { PageLayout, PageLayoutRevision } from "@/server/models";
import type { BlockBase } from "@/server/models/layout";
import { seedHomeLayout } from "@/server/seed/layouts";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const photo = { assetId: "a1", src: "/uploads/site/hero.webp", alt: "A bright living room", width: 1920, height: 640 };

/** A hero as the home page saved it before H6.13: the placeholder photo and the text, no look settings and no version. */
const oldDefault = { heading: "Find what you need", searchPlaceholder: "Search", imageDesktop: photo };

function block(props: Record<string, unknown>, id = "hero-1"): BlockBase {
  return { id, type: "hero", visible: true, props };
}

describe("hero conversion (pure)", () => {
  it("makes an old default hero a full banner and marks it with the version", () => {
    const converted = convertHeroProps(oldDefault);
    expect(converted).toEqual({ ...oldDefault, layout: "full", heroVersion: 2 });
    expect(resolveHero(converted!)).toMatchObject({ layout: "full", overlay: "none" });
  });

  it("does nothing to a block that is already at the current version", () => {
    expect(convertHeroProps({ ...oldDefault, layout: "full", heroVersion: 2 })).toBeNull();
    expect(convertHeroProps({ ...oldDefault, layout: "split", heroVersion: 2 })).toBeNull();
  });

  it("keeps a block with its own look setting as the split hero it was, and leaves its settings alone", () => {
    const custom = { ...oldDefault, textTone: "dark", overlayOn: true, overlayColor: "#112233" };
    const converted = convertHeroProps(custom)!;
    expect(converted.layout).toBe("split");
    expect(converted.heroVersion).toBe(2);
    expect(converted).toMatchObject({ textTone: "dark", overlayOn: true, overlayColor: "#112233", heading: "Find what you need" });
    expect(resolveHero(converted)).toMatchObject({ layout: "split", overlay: "color", textTone: "dark" });
  });

  it("keeps a layout the user chose and only adds the version", () => {
    expect(convertHeroProps({ ...oldDefault, layout: "split" })).toEqual({ ...oldDefault, layout: "split", heroVersion: 2 });
    expect(convertHeroProps({ ...oldDefault, layout: "full" })).toEqual({ ...oldDefault, layout: "full", heroVersion: 2 });
  });

  it("converts only hero blocks in a list and reports how many it changed", () => {
    const blocks: BlockBase[] = [
      block(oldDefault, "hero-1"),
      { id: "grid", type: "categoryGrid", visible: true, props: { title: "Browse categories" } },
    ];
    const first = convertHeroBlocks(blocks);
    expect(first.changed).toBe(1);
    expect(first.blocks[1]).toBe(blocks[1]);
    expect(convertHeroBlocks(first.blocks)).toEqual({ blocks: first.blocks, changed: 0 });
  });

  it("does not change the input blocks", () => {
    const blocks = [block({ ...oldDefault })];
    convertHeroBlocks(blocks);
    expect(blocks[0].props).not.toHaveProperty("layout");
  });
});

describe("hero conversion (database)", () => {
  beforeAll(async () => {
    await connectMemoryMongo();
    await PageLayout.init();
    await PageLayoutRevision.init();
  });

  beforeEach(async () => {
    await clearMemoryMongo();
  });

  afterAll(async () => {
    await disconnectMemoryMongo();
  });

  async function storeHome(hero: Record<string, unknown>) {
    const grid = { id: "grid", type: "categoryGrid", visible: true, props: { title: "Browse categories", items: [] } };
    await PageLayout.create({
      key: "home",
      scope: "default",
      draft: [block(hero, "hero-1"), grid],
      published: [block(hero, "hero-1"), grid],
      version: 1,
      updatedBy: "system",
      publishedBy: "system",
      publishedAt: new Date(),
    });
  }

  it("turns the stored old default into a full banner, and a second run changes nothing", async () => {
    await storeHome({ ...oldDefault });
    expect(await convertHeroLayouts("test:1")).toEqual({ updated: 1 });

    const stored = await PageLayout.findOne({ key: "home", scope: "default" }).lean();
    const hero = (stored!.published as BlockBase[])[0];
    expect(hero.props).toMatchObject({ layout: "full", heroVersion: 2, heading: "Find what you need" });
    expect((stored!.draft as BlockBase[])[0].props).toMatchObject({ layout: "full", heroVersion: 2 });
    // The other block is untouched.
    expect((stored!.published as BlockBase[])[1]).toMatchObject({ id: "grid", type: "categoryGrid", props: { title: "Browse categories", items: [] } });

    const before = JSON.stringify(stored);
    expect(await convertHeroLayouts("test:2")).toEqual({ updated: 0 });
    const after = await PageLayout.findOne({ key: "home", scope: "default" }).lean();
    expect(JSON.stringify(after)).toBe(before);
  });

  it("leaves a block with a custom setting in its split look, with its settings unchanged", async () => {
    const custom = { ...oldDefault, textTone: "dark", height: "large" };
    await storeHome(custom);
    expect(await convertHeroLayouts("test:custom")).toEqual({ updated: 1 });
    const stored = await PageLayout.findOne({ key: "home", scope: "default" }).lean();
    const hero = (stored!.published as BlockBase[])[0].props;
    expect(hero).toMatchObject({ layout: "split", heroVersion: 2, textTone: "dark", height: "large", heading: "Find what you need" });
    expect(resolveHero(hero)).toMatchObject({ layout: "split", overlay: "gradient", textTone: "dark", height: "large" });
  });

  it("does nothing when the home layout has no hero", async () => {
    await PageLayout.create({
      key: "home",
      scope: "default",
      draft: [{ id: "t", type: "trust", visible: true, props: {} }],
      published: [{ id: "t", type: "trust", visible: true, props: {} }],
      version: 1,
      updatedBy: "system",
      publishedBy: "system",
      publishedAt: new Date(),
    });
    expect(await convertHeroLayouts("test:none")).toEqual({ updated: 0 });
  });

  it("makes the seeded home hero a full banner that the public page reads, once the seed has run the conversion", async () => {
    expect(await seedHomeLayout()).toBe(true);
    // The built-in home hero is written with no layout and no version; the seed runs the conversion right after.
    expect((await getPublished("home", "default"))?.[0].props).not.toHaveProperty("heroVersion");
    expect(await convertHeroLayouts("seed:test")).toEqual({ updated: 1 });
    const published = await getPublished("home", "default");
    expect(published?.[0].props).toMatchObject({ layout: "full", heroVersion: 2 });
    expect(resolveHero(published![0].props)).toMatchObject({ layout: "full", overlay: "none" });
    expect(await convertHeroLayouts("seed:test")).toEqual({ updated: 0 });
  });

  it("keeps the converted blocks valid under the block schema", async () => {
    await storeHome({ ...oldDefault });
    await convertHeroLayouts("test:valid");
    const stored = await PageLayout.findOne({ key: "home", scope: "default" }).lean();
    expect(() => validateBlocks("home", stored!.published, new Set(["hero-1", "grid"]))).not.toThrow();
  });
});
