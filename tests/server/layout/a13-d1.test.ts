import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

import { HomeBlocksV2 } from "@/components/new/home-blocks/HomeBlocksV2";
import { NewHome } from "@/components/new/NewHome";
import { getPublishedHome, homeFromLayoutOn } from "@/lib/layout/home-read";
import { getHomepageContent } from "@/lib/queries";
import { D1_NOTE, runHomeLayoutD1 } from "@/server/layout/d1-home";
import { homeBlocksFrom } from "@/server/layout/home-v2";
import { AuditEvent, PageLayout, PageLayoutRevision, Site } from "@/server/models";
import { seedLegacyHome } from "./a19-legacy-home";
import { readShellConfig } from "@/server/site-links/shell-config";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";
import { HOME_FIXTURES } from "./a6-fixtures";

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

describe("D1 dry run (A13)", () => {
  it("builds the five format 2 blocks from the stored page and writes nothing", async () => {
    await seedLegacyHome();
    const before = await PageLayout.findOne({ key: "home" }).lean();
    const result = await runHomeLayoutD1({ apply: false });
    expect(result).toMatchObject({ action: "dry-run", fromVersion: 1, fromFormat: 1, toVersion: 2 });
    expect(result.blocks.map((block) => block.type)).toEqual(["homeBanner", "homeTrust", "homeCategories", "homeAds", "homeSteps"]);
    expect(await PageLayout.findOne({ key: "home" }).lean()).toEqual(before);
    expect(await PageLayoutRevision.countDocuments({ key: "home" })).toBe(1);
    expect(await AuditEvent.countDocuments({ action: "layout.d1.apply" })).toBe(0);
  });

  it("draws the same page as today's New design home", async () => {
    const result = await runHomeLayoutD1({ apply: false });
    const content = await getHomepageContent();
    const shell = await readShellConfig();
    const { categories, ads, paths, countries } = HOME_FIXTURES.plain;
    const data = { categories, ads, shell, paths, countries, texts: {} };
    const old = renderToStaticMarkup(createElement(NewHome, { ...data, hero: content.hero, categoriesCount: content.homeCategoriesCount } as never));
    const next = renderToStaticMarkup(createElement(HomeBlocksV2, { blocks: result.blocks, data: data as never }));
    expect(next).toBe(old);
    const made = homeBlocksFrom({ hero: content.hero, shell, texts: {}, categoriesCount: content.homeCategoriesCount });
    expect(result.blocks.map(({ id, type, props }) => ({ id, type, props }))).toEqual(made.map(({ id, type, props }) => ({ id, type, props })));
  });
});

describe("D1 apply (A13)", () => {
  it("publishes version n+1 as format 2 with the note D1, keeps the old version as a revision, and leaves the switch off", async () => {
    await seedLegacyHome();
    const result = await runHomeLayoutD1({ apply: true, actor: "d1-test" });
    expect(result).toMatchObject({ action: "applied", fromVersion: 1, toVersion: 2 });
    const doc = await PageLayout.findOne({ key: "home", scope: "default" }).lean();
    expect(doc).toMatchObject({ format: 2, version: 2, publishedBy: "d1-test" });
    expect((doc?.published as unknown[]).length).toBe(5);
    const revisions = await PageLayoutRevision.find({ key: "home" }).sort({ version: 1 }).lean();
    expect(revisions.map((row) => [row.version, row.format ?? 1, row.note])).toEqual([
      [1, 1, "Default layout from the current home page"],
      [2, 2, D1_NOTE],
    ]);
    expect(await AuditEvent.countDocuments({ action: "layout.d1.apply" })).toBe(1);
    expect(await homeFromLayoutOn()).toBe(false);
    expect(await Site.countDocuments({ homeFromLayout: true })).toBe(0);
    expect((await getPublishedHome())?.format).toBe(2);
  });

  it("starts at version 1 when there is no home layout yet", async () => {
    const result = await runHomeLayoutD1({ apply: true });
    expect(result).toMatchObject({ action: "applied", fromVersion: 0, toVersion: 1 });
    expect(await PageLayoutRevision.countDocuments({ key: "home", version: 1, format: 2 })).toBe(1);
  });

  it("does nothing the second time, and refuses to replace a format 2 home someone changed", async () => {
    await runHomeLayoutD1({ apply: true });
    expect(await runHomeLayoutD1({ apply: true })).toMatchObject({ action: "unchanged", toVersion: 1 });
    expect(await PageLayoutRevision.countDocuments({ key: "home" })).toBe(1);
    await PageLayout.updateOne({ key: "home", scope: "default" }, { $set: { "published.0.props.h1": "Edited in the builder" } });
    const refused = await runHomeLayoutD1({ apply: true });
    expect(refused.action).toBe("refused");
    const doc = await PageLayout.findOne({ key: "home", scope: "default" }).lean<{ published: { props: { h1: string } }[]; version: number }>();
    expect(doc?.published[0].props.h1).toBe("Edited in the builder");
    expect(doc?.version).toBe(1);
  });

  it("reads the switch as off until it is set to true", async () => {
    expect(await homeFromLayoutOn()).toBe(false);
    await Site.create({ key: "default", homeFromLayout: true });
    expect(await homeFromLayoutOn()).toBe(true);
  });
});
