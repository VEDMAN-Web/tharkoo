import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { invalidateTags } from "@/lib/cache";
import { getPublishedHome } from "@/lib/layout/home-read";
import type { AdminCtx } from "@/server/admin/context";
import { undoEvent } from "@/server/admin/undo/core";
import { ForbiddenError, ValidationError } from "@/server/http";
import { runHomeLayoutD1 } from "@/server/layout/d1-home";
import { loadHomeBuilder, publishHome, restoreHomeVersion, saveHomeDraft } from "@/server/layout/home-builder";
import { formatOf, homeBannerProblem, publish, saveDraft } from "@/server/layout/service";
import { homePickerData } from "@/server/listings/home-selection";
import { AuditEvent, Category, Listing, PageLayout, PageLayoutRevision, User } from "@/server/models";
import type { BlockBase } from "@/server/models/layout";
import { SEED_USER_EMAIL } from "@/server/seed/data";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin: AdminCtx = { actorId: new mongoose.Types.ObjectId().toString(), email: "admin@example.test", roles: ["admin"], requestId: "req" };
const moderator: AdminCtx = { ...admin, roles: ["moderator"] };

const picture = { assetId: "a1", src: "/placeholders/hero/banner.webp", alt: "People in a city", width: 2400, height: 1029 };

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
  await PageLayout.init();
  await PageLayoutRevision.init();
});
beforeEach(async () => {
  await clearMemoryMongo();
  invalidateTags(["layout:home", "site"]);
});
afterAll(async () => {
  await disconnectMemoryMongo();
});

async function starter(): Promise<BlockBase[]> {
  return (await loadHomeBuilder(admin)).blocks;
}

function editH1(blocks: BlockBase[], h1: string): BlockBase[] {
  return blocks.map((block) => (block.type === "homeBanner" ? { ...block, props: { ...block.props, h1, imageDesktop: picture } } : block));
}

describe("the Home tab starts from today's page (A16)", () => {
  it("makes five blocks from the stored page when nothing is saved, and shows nothing as live", async () => {
    const state = await loadHomeBuilder(admin);
    expect(state.starter).toBe(true);
    expect(state.blocks.map((block) => block.type)).toEqual(["homeBanner", "homeTrust", "homeCategories", "homeAds", "homeSteps"]);
    expect(state).toMatchObject({ liveVersion: 0, switchOn: false, draftSavedAt: null });
    expect(await PageLayout.countDocuments({ key: "home" })).toBe(0);
  });

  it("is for admins only", async () => {
    await expect(loadHomeBuilder(moderator)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(saveHomeDraft(moderator, [])).rejects.toBeInstanceOf(ForbiddenError);
    await expect(publishHome(moderator)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(restoreHomeVersion(moderator, 1)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("saving and publishing (A16)", () => {
  it("a draft save of a format 2 home keeps the format and does not touch the live version", async () => {
    await runHomeLayoutD1({ apply: true });
    const live = await PageLayout.findOne({ key: "home" }).lean();
    const state = await loadHomeBuilder(admin);
    expect(state).toMatchObject({ starter: false, liveVersion: 1, liveFormat: 2 });
    await saveHomeDraft(admin, editH1(state.blocks, "A new headline"));
    const after = await PageLayout.findOne({ key: "home" }).lean();
    expect(after?.format).toBe(2);
    expect(after?.version).toBe(1);
    expect(JSON.stringify(after?.published)).toBe(JSON.stringify(live?.published));
    expect((after?.draft as BlockBase[]).find((block) => block.type === "homeBanner")?.props.h1).toBe("A new headline");
  });

  it("refuses a banner picture without its description, on save and on publish", async () => {
    const blocks = (await starter()).map((block) => (block.type === "homeBanner" ? { ...block, props: { ...block.props, imageDesktop: { ...picture, alt: "" } } } : block));
    await expect(saveHomeDraft(admin, blocks)).rejects.toBeInstanceOf(ValidationError);
    expect(homeBannerProblem(blocks as BlockBase[])).toMatch(/picture description/);
    await PageLayout.create({ key: "home", scope: "default", draft: blocks, published: [], version: 0 });
    await expect(publishHome(admin)).rejects.toThrow(/picture description/);
    expect(await PageLayoutRevision.countDocuments({ key: "home" })).toBe(0);
  });

  it("publishes the draft as version 1 in format 2, with one audit line and no Undo when nothing was live before", async () => {
    await saveHomeDraft(admin, editH1(await starter(), "First headline"));
    const done = await publishHome(admin, "first");
    expect(done).toMatchObject({ version: 1, canUndo: false });
    const doc = await PageLayout.findOne({ key: "home" }).lean();
    expect(doc).toMatchObject({ format: 2, version: 1, publishedBy: "admin@example.test" });
    expect(await PageLayoutRevision.findOne({ key: "home", version: 1 }).lean()).toMatchObject({ format: 2, note: "first" });
    const rows = await AuditEvent.find({ action: "layout.publish" }).lean<{ summary?: string; undo?: unknown }[]>();
    expect(rows).toHaveLength(1);
    expect(rows[0].summary).toBe("Published the Home page as version 1");
    expect(rows[0].undo).toBeUndefined();
    expect((await getPublishedHome())?.format).toBe(2);
  });

  it("an old editor publish of format 1 blocks records format 1", async () => {
    const heroBlocks = [{ type: "hero", visible: true, props: { heading: "Hello", alt: "A hero picture", subheading: "", searchPlaceholder: "" } }];
    await saveDraft({ key: "home", scope: "default", blocks: heroBlocks, email: "a@example.test", roles: ["admin"] });
    await publish({ key: "home", scope: "default", email: "a@example.test", roles: ["admin"] });
    expect((await PageLayout.findOne({ key: "home" }).lean())?.format).toBe(1);
    expect(formatOf(heroBlocks)).toBe(1);
    expect(formatOf([])).toBe(1);
  });
});

describe("undo of a publish and restore (A16)", () => {
  async function publishTwo() {
    await saveHomeDraft(admin, editH1(await starter(), "Version one"));
    await publishHome(admin);
    await saveHomeDraft(admin, editH1((await loadHomeBuilder(admin)).blocks, "Version two"));
    return publishHome(admin);
  }
  const live = async () => (await PageLayout.findOne({ key: "home" }).lean<{ version: number; published: BlockBase[] }>())!;
  const h1Of = (blocks: BlockBase[]) => blocks.find((block) => block.type === "homeBanner")?.props.h1;

  it("Undo puts the previous version back as the next version, and undoing the undo brings it forward again", async () => {
    const second = await publishTwo();
    expect(second.canUndo).toBe(true);
    const undone = await undoEvent(admin, second.eventId);
    expect(undone.ok).toBe(true);
    const back = await live();
    expect(back.version).toBe(3);
    expect(h1Of(back.published)).toBe("Version one");
    expect(await PageLayoutRevision.countDocuments({ key: "home" })).toBe(3);
    if (!undone.ok) return;
    const redone = await undoEvent(admin, undone.eventId);
    expect(redone.ok).toBe(true);
    expect(h1Of((await live()).published)).toBe("Version two");
    expect((await live()).version).toBe(4);
  });

  it("Undo is refused when the page was published again since", async () => {
    const second = await publishTwo();
    await saveHomeDraft(admin, editH1((await loadHomeBuilder(admin)).blocks, "Version three"));
    await publishHome(admin);
    const outcome = await undoEvent(admin, second.eventId);
    expect(outcome).toMatchObject({ ok: false, reason: "conflict" });
    expect(h1Of((await live()).published)).toBe("Version three");
  });

  it("restore puts an earlier version into the draft only", async () => {
    await publishTwo();
    const restored = await restoreHomeVersion(admin, 1);
    expect(h1Of(restored.blocks)).toBe("Version one");
    expect((await live()).version).toBe(2);
    expect(h1Of((await live()).published)).toBe("Version two");
    expect(h1Of((await PageLayout.findOne({ key: "home" }).lean<{ draft: BlockBase[] }>())!.draft)).toBe("Version one");
  });
});

describe("the 8 slots (A16)", () => {
  it("mark a demo ad (seed owner, demo slug) so the builder can badge it", async () => {
    const seed = await User.create({ email: SEED_USER_EMAIL, passwordHash: "x", displayName: "Seed", dateOfBirth: new Date("1995-01-01"), attestedAdultAt: new Date() });
    const owner = await User.create({ email: "real@example.test", passwordHash: "x", displayName: "Real", dateOfBirth: new Date("1995-01-01"), attestedAdultAt: new Date() });
    const category = await Category.create({ slug: "dating", name: "Dating", enabled: true, order: 0, fields: [], minListingsIndex: 1 });
    const make = (slug: string, ownerId: mongoose.Types.ObjectId) =>
      Listing.create({ ownerId, categoryId: category._id, title: slug, slug, description: "A plain ad.", status: "active", homeShow: true, homeOrder: slug === "demo-0001" ? 1 : 2, publishedAt: new Date() });
    await make("demo-0001", seed._id);
    await make("real-ad-0002", owner._id);
    const { pinned } = await homePickerData();
    expect(pinned.map((row) => [row.title, row.demo])).toEqual([
      ["demo-0001", true],
      ["real-ad-0002", false],
    ]);
  });
});
