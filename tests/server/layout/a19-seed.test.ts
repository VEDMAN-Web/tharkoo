import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as siteStore from "@/lib/ui/site-store";
import type { AdminCtx } from "@/server/admin/context";
import { loadHomeBuilder } from "@/server/layout/home-builder";
import { formatOf } from "@/server/layout/service";
import { PageLayout, PageLayoutRevision } from "@/server/models";
import type { BlockBase } from "@/server/models/layout";
import { seedHomeLayout } from "@/server/seed/layouts";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";
import { seedLegacyHome } from "./a19-legacy-home";

const admin: AdminCtx = { actorId: new mongoose.Types.ObjectId().toString(), email: "admin@example.test", roles: ["admin"], requestId: "req" };

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
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

describe("seedHomeLayout makes a format 2 home (A19)", () => {
  it("creates version 1 as format 2 with the five home blocks, and the Page builder opens it as a saved draft", async () => {
    expect(await seedHomeLayout()).toBe(true);
    const doc = await PageLayout.findOne({ key: "home", scope: "default" }).lean();
    expect(doc).toMatchObject({ format: 2, version: 1 });
    expect(formatOf(doc?.published as BlockBase[])).toBe(2);
    expect(await PageLayoutRevision.findOne({ key: "home", version: 1 }).lean()).toMatchObject({ format: 2 });
    const state = await loadHomeBuilder(admin);
    expect(state).toMatchObject({ starter: false, liveVersion: 1, liveFormat: 2 });
    expect(state.blocks.map((block) => block.type)).toEqual(["homeBanner", "homeTrust", "homeCategories", "homeAds", "homeSteps"]);
  });

  it("does nothing when a layout already exists, even an old format 1 one", async () => {
    await seedLegacyHome();
    expect(await seedHomeLayout()).toBe(false);
    const doc = await PageLayout.findOne({ key: "home" }).lean();
    expect(doc?.format ?? 1).toBe(1);
    expect(doc?.version).toBe(1);
  });
});

describe("the old Home banner and category count writers are gone (A19)", () => {
  it("site-store exports no banner or category count writer", () => {
    expect("applyHomeBanner" in siteStore).toBe(false);
    expect("applyHomeCategoriesCount" in siteStore).toBe(false);
    expect(siteStore.HOME_MOVED_MESSAGE).toMatch(/Page builder/);
  });
});
