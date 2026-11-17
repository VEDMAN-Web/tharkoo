import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AdminCtx } from "@/server/admin/context";
import { ForbiddenError, ValidationError } from "@/server/http";
import { loadListingTitle } from "@/app/admin/page-builder/_listing/server";
import { tabOf } from "@/app/admin/page-builder/tabs";
import { listingDefaultBlocks } from "@/server/layout/defaults/listing";
import { validateBlocks } from "@/server/layout/service";
import { Category } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin: AdminCtx = { actorId: new mongoose.Types.ObjectId().toString(), email: "admin@example.test", roles: ["admin"], requestId: "req" };
const moderator: AdminCtx = { ...admin, roles: ["moderator"] };

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
});

describe("the Google title of a listing scope (H8.55)", () => {
  it("all listing pages edit the all-category template, with a sample and no name", async () => {
    const state = await loadListingTitle(admin, "default");
    expect(state.target).toEqual({ kind: "template", pageType: "category", categorySlug: null });
    expect(state.siteLabel).toMatch(/\/jobs\/$/);
    expect(state.previewVars).not.toBeNull();
    expect(state.help).toMatch(/every category page/);
  });

  it("one category edits that category's template and previews with its name", async () => {
    await Category.create({ slug: "dating", name: "Dating", enabled: true, order: 0 });
    const state = await loadListingTitle(admin, "category:dating");
    expect(state.target).toEqual({ kind: "template", pageType: "category", categorySlug: "dating" });
    expect(state.previewVars?.category).toBe("Dating");
    expect(state.siteLabel).toMatch(/\/dating\/$/);
  });

  it("one exact address edits that address, and a bad address or an unknown category is refused", async () => {
    const state = await loadListingTitle(admin, "url:/property/surat/");
    expect(state.target).toEqual({ kind: "url", path: "/property/surat/" });
    expect(state.previewVars).toBeNull();
    await expect(loadListingTitle(admin, "url:not-an-address")).rejects.toBeInstanceOf(ValidationError);
    await expect(loadListingTitle(admin, "category:nope")).rejects.toThrow();
  });

  it("is for admins only", async () => {
    await expect(loadListingTitle(moderator, "default")).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("small rules of the tab (H8.55)", () => {
  it("reads the tab from the address and opens Home for anything else", () => {
    expect(tabOf("listing")).toBe("listing");
    expect(tabOf("post")).toBe("post");
    expect(tabOf("nonsense")).toBe("home");
    expect(tabOf(undefined)).toBe("home");
  });

  it("the starting layout is what the pages show today and is valid", () => {
    const blocks = validateBlocks("listing", listingDefaultBlocks(), new Set());
    expect(blocks.map((block) => block.type)).toEqual(["filters", "listingHeader", "listingFeed", "relatedCategories", "nearbyCities"]);
    expect(new Set(blocks.map((block) => block.id)).size).toBe(blocks.length);
  });
});
