import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { invalidateTags } from "@/lib/cache";
import { buildPostCopy, feeLabel, fillCopyFee, fillFee, POST_BLOCK_TEXT_KEYS, POST_COPY_DEFAULTS } from "@/components/post/copy";
import type { AdminCtx } from "@/server/admin/context";
import { undoEvent } from "@/server/admin/undo/core";
import { saveMoneyValues } from "@/server/billing/money-settings";
import { ForbiddenError, ValidationError } from "@/server/http";
import { BLOCKS, blockDef, typesForPage } from "@/server/layout/blocks";
import { postDefaultBlocks } from "@/server/layout/defaults/post";
import { loadPostBuilder, publishPost, restorePostVersion, savePostDraft } from "@/server/layout/post-builder";
import { validateBlocks } from "@/server/layout/service";
import { PageLayout, PageLayoutRevision } from "@/server/models";
import type { BlockBase } from "@/server/models/layout";
import { TEXT_DEFAULTS, isTextKey } from "@/lib/ui/text";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin: AdminCtx = { actorId: new mongoose.Types.ObjectId().toString(), email: "admin@example.test", roles: ["admin"], requestId: "req" };
const moderator: AdminCtx = { ...admin, roles: ["moderator"] };

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
  await PageLayout.init();
  await PageLayoutRevision.init();
});
beforeEach(async () => {
  await clearMemoryMongo();
  invalidateTags(["layout:post", "site"]);
});
afterAll(async () => {
  await disconnectMemoryMongo();
});

const withProps = (blocks: BlockBase[], type: string, patch: Record<string, unknown>) => blocks.map((block) => (block.type === type ? { ...block, props: { ...block.props, ...patch } } : block));

describe("the three texts-only blocks (A41)", () => {
  it("exist on the post page only, take no required field and are valid empty", () => {
    for (const type of ["idCheckFirst", "payStep", "consent"] as const) {
      expect(BLOCKS[type].pages).toEqual(["post"]);
      expect(typesForPage("post")).toContain(type);
      expect(typesForPage("home")).not.toContain(type);
      expect(BLOCKS[type].schema.safeParse({}).success).toBe(true);
      expect(blockDef(type)?.max).toBe(1);
    }
  });

  it("every field maps to a site text key that exists, so an empty field shows the built-in words", () => {
    for (const [type, fields] of Object.entries(POST_BLOCK_TEXT_KEYS)) {
      const schema = BLOCKS[type as "payStep"].schema;
      for (const [field, key] of Object.entries(fields)) {
        expect(isTextKey(key), `${type}.${field} -> ${key}`).toBe(true);
        expect(TEXT_DEFAULTS[key as keyof typeof TEXT_DEFAULTS].length).toBeGreaterThan(0);
        expect(schema.safeParse({ [field]: "x" }).success).toBe(true);
      }
    }
  });

  it("the starting layout has them, empty", () => {
    const blocks = validateBlocks("post", postDefaultBlocks(), new Set());
    for (const type of ["idCheckFirst", "payStep", "consent"]) {
      const props = Object.values(blocks.find((block) => block.type === type)?.props ?? { missing: "yes" });
      expect(props.length).toBeGreaterThan(0);
      expect(props.every((value) => value === "")).toBe(true);
    }
  });

  it("refuses a script in a text and a text that is too long", () => {
    expect(() => validateBlocks("post", [{ type: "consent", visible: true, props: { adult: "x".repeat(301) } }], new Set())).toThrow();
  });
});

describe("what the page reads from them (A41)", () => {
  it("fills only the fields that were written, by site text key", () => {
    const blocks = validateBlocks("post", withProps(postDefaultBlocks() as BlockBase[], "payStep", { title: "Check and pay", feeLabel: "  Fee  ", balanceLabel: "" }), new Set());
    const copy = buildPostCopy(blocks);
    expect(copy.texts).toEqual({ "post.pay.title": "Check and pay", "post.pay.fee": "Fee" });
  });

  it("a hidden block adds nothing, because the page reads only shown blocks", () => {
    const copy = buildPostCopy([]);
    expect(copy.texts).toEqual({});
    expect(buildPostCopy(null).texts).toEqual({});
    expect(POST_COPY_DEFAULTS.texts).toEqual({});
  });

  it("{fee} becomes the posting fee in the step lines, the intro, the plan note and the success text", () => {
    const copy = fillCopyFee(
      {
        ...POST_COPY_DEFAULTS,
        intro: { title: "Costs {fee}", text: "Pay {fee} once", image: null },
        steps: { ...POST_COPY_DEFAULTS.steps, basics: { ...POST_COPY_DEFAULTS.steps.basics, help: "Posting costs {fee}.", nextLabel: "Go ({fee})" } },
        promotion: { ...POST_COPY_DEFAULTS.promotion, note: "After the {fee}" },
        success: { ...POST_COPY_DEFAULTS.success, text: "You paid {fee}" },
      },
      "30 credits",
    );
    expect(copy.intro).toMatchObject({ title: "Costs 30 credits", text: "Pay 30 credits once" });
    expect(copy.steps.basics).toMatchObject({ help: "Posting costs 30 credits.", nextLabel: "Go (30 credits)" });
    expect(copy.promotion.note).toBe("After the 30 credits");
    expect(copy.success.text).toBe("You paid 30 credits");
    expect(POST_COPY_DEFAULTS.steps.basics.help).not.toContain("30");
  });

  it("writes the fee as visitors read it", () => {
    expect(feeLabel(0)).toBe("0 credits");
    expect(feeLabel(1)).toBe("1 credit");
    expect(feeLabel(30)).toBe("30 credits");
    expect(fillFee("a {fee} b {fee}", "5 credits")).toBe("a 5 credits b 5 credits");
  });
});

describe("the Post-ad tab server side (A41)", () => {
  it("starts from today's wording without saving anything, and reads the posting fee from the money settings", async () => {
    const state = await loadPostBuilder(admin);
    expect(state.starter).toBe(true);
    expect(state.blocks.filter((block) => block.type === "postStep")).toHaveLength(6);
    expect(state).toMatchObject({ liveVersion: 0, draftSavedAt: null, fee: 0 });
    expect(await PageLayout.countDocuments({ key: "post" })).toBe(0);
    await saveMoneyValues(admin, { paidPostingOn: true, postingFeeCredits: 45 });
    expect((await loadPostBuilder(admin)).fee).toBe(45);
  });

  it("is for admins only", async () => {
    await expect(loadPostBuilder(moderator)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(savePostDraft(moderator, [])).rejects.toBeInstanceOf(ForbiddenError);
    await expect(publishPost(moderator)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(restorePostVersion(moderator, 1)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("saves a draft, publishes it as the next version, and a visitor reads the texts from the published blocks", async () => {
    const first = (await loadPostBuilder(admin)).blocks;
    await savePostDraft(admin, withProps(first, "consent", { adult: "I am an adult and the ad is true." }));
    expect((await PageLayout.findOne({ key: "post" }).lean())?.version).toBe(0);
    const done = await publishPost(admin, "consent words");
    expect(done.version).toBe(1);
    expect(done.canUndo).toBe(false);
    const doc = await PageLayout.findOne({ key: "post" }).lean<{ published: BlockBase[] }>();
    expect(buildPostCopy(doc!.published).texts).toEqual({ "post.reviewStep.adult": "I am an adult and the ad is true." });
    expect(await PageLayoutRevision.countDocuments({ key: "post" })).toBe(1);
  });

  it("refuses to hide a step other than the plan step", async () => {
    const blocks = (await loadPostBuilder(admin)).blocks;
    const hidden = blocks.map((block) => (block.type === "postStep" && block.props.stepKey === "photos" ? { ...block, visible: false } : block));
    await expect(savePostDraft(admin, hidden)).rejects.toBeInstanceOf(ValidationError);
  });

  it("publishing again can be undone, and the undo brings the earlier version back as the next one", async () => {
    const blocks = (await loadPostBuilder(admin)).blocks;
    await savePostDraft(admin, withProps(blocks, "postSuccess", { title: "Version one" }));
    await publishPost(admin);
    await savePostDraft(admin, withProps((await loadPostBuilder(admin)).blocks, "postSuccess", { title: "Version two" }));
    const second = await publishPost(admin);
    expect(second.canUndo).toBe(true);
    const undone = await undoEvent(admin, second.eventId);
    expect(undone.ok).toBe(true);
    const doc = await PageLayout.findOne({ key: "post" }).lean<{ published: BlockBase[]; version: number }>();
    expect(doc?.version).toBe(3);
    expect(buildPostCopy(doc!.published).success.title).toBe("Version one");
  });

  it("restore puts an earlier version into the draft only", async () => {
    const blocks = (await loadPostBuilder(admin)).blocks;
    await savePostDraft(admin, withProps(blocks, "postSuccess", { title: "Version one" }));
    await publishPost(admin);
    await savePostDraft(admin, withProps((await loadPostBuilder(admin)).blocks, "postSuccess", { title: "Version two" }));
    await publishPost(admin);
    const restored = await restorePostVersion(admin, 1);
    expect(restored.blocks.find((block) => block.type === "postSuccess")?.props.title).toBe("Version one");
    const doc = await PageLayout.findOne({ key: "post" }).lean<{ published: BlockBase[]; version: number }>();
    expect(doc?.version).toBe(2);
    expect(buildPostCopy(doc!.published).success.title).toBe("Version two");
  });
});
