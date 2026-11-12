import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pickH1 } from "@/components/blocks/HomeLayout";
import { getPageBlocks } from "@/lib/layout/read";
import { defaultSiteContent } from "@/lib/ui/site-content";
import { homeDefaultBlocks } from "@/server/layout/defaults/home";
import { getPublished, publish, saveDraft, validateBlocks } from "@/server/layout/service";
import { PageLayout, PageLayoutRevision } from "@/server/models";
import { seedHomeLayout } from "@/server/seed/layouts";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin = { email: "admin@example.test", roles: ["admin"] };

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

describe("home default blocks", () => {
  it("turn the current home page content into valid blocks", () => {
    const content = defaultSiteContent();
    const blocks = validateBlocks("home", homeDefaultBlocks(content), new Set());
    expect(blocks[0].type).toBe("hero");
    expect(blocks[0].props.heading).toBe(content.hero.desktop);
    expect((blocks[0].props.primaryCta as { label: string }).label).toBe(content.hero.postLabel);
    const grid = blocks.find((block) => block.type === "categoryGrid")!;
    expect(grid.props.title).toBe(content.cardsHeading);
    expect((grid.props.items as { categorySlug: string }[]).map((item) => item.categorySlug)).toEqual(content.cards.map((card) => card.slug));
  });

  it("leave out hidden cards and an empty SEO intro", () => {
    const content = defaultSiteContent();
    content.cards[0].visible = false;
    content.seoIntro = "";
    const blocks = validateBlocks("home", homeDefaultBlocks(content), new Set());
    const grid = blocks.find((block) => block.type === "categoryGrid")!;
    expect((grid.props.items as unknown[]).length).toBe(content.cards.length - 1);
    expect(blocks.some((block) => block.type === "seoText")).toBe(false);
    content.seoIntro = "<p>About Tharkoo.</p>";
    expect(validateBlocks("home", homeDefaultBlocks(content), new Set()).some((block) => block.type === "seoText")).toBe(true);
  });
});

describe("home layout seed", () => {
  it("publishes version 1 once and is safe to run again", async () => {
    expect(await seedHomeLayout()).toBe(true);
    expect(await seedHomeLayout()).toBe(false);
    expect(await PageLayout.countDocuments({ key: "home", scope: "default" })).toBe(1);
    expect(await PageLayoutRevision.countDocuments({ key: "home" })).toBe(1);
    const published = await getPublished("home", "default");
    expect(published?.[0].type).toBe("hero");
    const read = await getPageBlocks("home", ["default"]);
    expect(read?.map((block) => block.type)).toEqual(published?.map((block) => block.type));
  });

  it("does not touch a layout an admin already saved", async () => {
    await saveDraft({ key: "home", scope: "default", blocks: [{ type: "richText", visible: true, props: { title: "Mine", body: "x" } }], ...admin });
    expect(await seedHomeLayout()).toBe(false);
    expect((await PageLayout.findOne({ key: "home" }).lean())?.draft).toHaveLength(1);
  });
});

describe("home h1", () => {
  const block = (type: string, props: Record<string, unknown>, id = type) => ({ id, type, visible: true, props });

  it("comes from the hero when there is one", () => {
    expect(pickH1([block("hero", { heading: "Hello" }), block("richText", { title: "Other" })])).toEqual({ hidden: false });
  });

  it("falls back to the first rich text title when the hero is gone", () => {
    expect(pickH1([block("richText", { title: "Welcome" }, "r1")])).toEqual({ blockId: "r1", hidden: false });
  });

  it("falls back to a hidden h1 when nothing has a title", () => {
    expect(pickH1([block("richText", { body: "text only" })])).toEqual({ hidden: true });
    expect(pickH1([])).toEqual({ hidden: true });
  });

  it("is a publish away from changing what the page reads", async () => {
    await seedHomeLayout();
    const base = (await getPublished("home", "default"))!;
    const edited = base.map((b) => (b.type === "hero" ? { ...b, props: { ...b.props, heading: "A new headline" } } : b));
    await saveDraft({ key: "home", scope: "default", blocks: edited, ...admin });
    expect((await getPageBlocks("home", ["default"]))![0].props.heading).not.toBe("A new headline");
    await publish({ key: "home", scope: "default", ...admin });
    expect((await getPageBlocks("home", ["default"]))![0].props.heading).toBe("A new headline");
  });
});
