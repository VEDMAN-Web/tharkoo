import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const revalidateTag = vi.fn();
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidateTag: (...args: unknown[]) => revalidateTag(...args), revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

import { purgeFailureLog, purgeNext, refreshPublicCache } from "@/lib/cache";
import { saveUiText } from "@/app/admin/ui-text/store";
import { normaliseSeoSettings } from "@/app/admin/seo/settings/rules";
import { saveSeoSettings } from "@/app/admin/seo/settings/store";
import { setMoneySettings } from "@/server/billing/money-settings";
import { publish, restore, saveDraft } from "@/server/layout/service";
import { PageLayout, PageLayoutRevision } from "@/server/models";
import { createCategory } from "@/server/categories/manage";
import { TEXT_DEFAULTS } from "@/lib/ui/text";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

/**
 * H7.140: an admin save must reach the public site at once. Every kind of caller runs a real service function and the test checks that
 * Next was asked to expire the public tags and the layout, and that a failure is reported once with the caller's name instead of being swallowed.
 */

const PUBLIC_TAGS = ["site", "categories", "locations", "feed", "listings", "counts"];
const tagsAsked = () => revalidateTag.mock.calls.map((call) => call[0] as string);
const layoutAsked = () => revalidatePath.mock.calls.some((call) => call[0] === "/" && call[1] === "layout");

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
  await PageLayout.init();
  await PageLayoutRevision.init();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
  revalidateTag.mockReset();
  revalidatePath.mockReset();
  purgeFailureLog.length = 0;
});

describe("the helper", () => {
  it("expires every public tag with no delay and the whole layout", async () => {
    expect(await purgeNext({ tags: PUBLIC_TAGS, paths: [["/", "layout"], "/sitemap.xml"], caller: "test" })).toBe(true);
    expect(tagsAsked()).toEqual(PUBLIC_TAGS);
    expect(revalidateTag.mock.calls.every((call) => JSON.stringify(call[1]) === JSON.stringify({ expire: 0 }))).toBe(true);
    expect(layoutAsked()).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith("/sitemap.xml");
    expect(purgeFailureLog).toEqual([]);
  });

  it("reports the failure once per caller, with the caller's name, and does not throw", async () => {
    revalidateTag.mockImplementation(() => {
      throw new Error('Invariant: static generation store missing in revalidateTag("site")');
    });
    expect(await purgeNext({ tags: ["site"], caller: "money settings" })).toBe(false);
    expect(await purgeNext({ tags: ["site"], caller: "money settings" })).toBe(false);
    expect(await purgeNext({ tags: ["site"], caller: "site text" })).toBe(false);
    expect(purgeFailureLog).toHaveLength(2);
    expect(purgeFailureLog[0]).toContain("money settings");
    expect(purgeFailureLog[0]).toContain("static generation store missing");
    expect(purgeFailureLog[1]).toContain("site text");
  });

  it("names the calling function when no name is given", async () => {
    revalidateTag.mockImplementation(() => {
      throw new Error("no store");
    });
    async function saveSomethingForTheTest() {
      await refreshPublicCache();
    }
    await saveSomethingForTheTest();
    expect(purgeFailureLog[0]).toContain("saveSomethingForTheTest");
  });
});

describe("each kind of caller reaches the public site", () => {
  it("prices: setMoneySettings", async () => {
    await setMoneySettings({ actorId: "000000000000000000000001", roles: ["admin"], values: { creditPriceInr: 11 }, requestId: "r1" });
    expect(tagsAsked()).toEqual(expect.arrayContaining(PUBLIC_TAGS));
    expect(layoutAsked()).toBe(true);
  });

  it("categories: createCategory", async () => {
    await createCategory({ email: "", roles: ["admin"] }, { name: "Garden help", kind: "service" });
    expect(tagsAsked()).toEqual(expect.arrayContaining(["categories", "feed"]));
    expect(layoutAsked()).toBe(true);
  });

  it("SEO settings: saveSeoSettings", async () => {
    await saveSeoSettings({ email: "", roles: ["admin"] }, normaliseSeoSettings(undefined));
    expect(tagsAsked()).toEqual(expect.arrayContaining(["site"]));
    expect(layoutAsked()).toBe(true);
  });

  it("page layout: publish, also after restoring an older version into the draft", async () => {
    const admin = { email: "admin@example.test", roles: ["admin"] };
    const block = (body: string) => ({ type: "richText", visible: true, props: { body } });
    await saveDraft({ key: "home", scope: "default", blocks: [block("<p>One</p>")], ...admin });
    await publish({ key: "home", scope: "default", ...admin });
    expect(tagsAsked()).toContain("layout:home");
    expect(layoutAsked()).toBe(true);
    // Restore only changes the draft, so nothing public is purged until the next publish.
    await restore({ key: "home", scope: "default", version: 1, ...admin });
    revalidateTag.mockClear();
    revalidatePath.mockClear();
    await publish({ key: "home", scope: "default", ...admin });
    expect(tagsAsked()).toContain("layout:home");
    expect(layoutAsked()).toBe(true);
    expect(purgeFailureLog).toEqual([]);
  });

  it("site text: saveUiText", async () => {
    await saveUiText({ roles: ["admin"], email: "", key: "home.utility.live", value: "People online right now" });
    expect(tagsAsked()).toContain("layout:text");
    expect(layoutAsked()).toBe(true);
    expect(TEXT_DEFAULTS["home.utility.live"]).not.toBe("People online right now");
  });
});
