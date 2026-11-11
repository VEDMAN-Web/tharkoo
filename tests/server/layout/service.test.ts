import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getPageBlocks, inWindow } from "@/lib/layout/read";
import { getDraft, getPublished, listRevisions, publish, restore, saveDraft } from "@/server/layout/service";
import { AuditEvent, PageLayout, PageLayoutRevision } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin = { email: "admin@example.test", roles: ["admin"] };
const rich = (body: string, extra: Record<string, unknown> = {}) => ({ type: "richText", visible: true, props: { body }, ...extra });
const listing = (feedTitle = "No ads") => [
  { type: "listingHeader", visible: true, props: { h1Template: "{category} in {city}" } },
  { type: "listingFeed", visible: true, props: { emptyTitle: feedTitle } },
];

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

describe("layout service", () => {
  it("refuses non-admin roles", async () => {
    for (const roles of [["user"], ["moderator"], ["seo_editor"], []]) {
      await expect(saveDraft({ key: "home", scope: "default", blocks: [], email: "x@example.test", roles })).rejects.toThrow(/admin/i);
      await expect(publish({ key: "home", scope: "default", email: "x@example.test", roles })).rejects.toThrow(/admin/i);
      await expect(restore({ key: "home", scope: "default", version: 1, email: "x@example.test", roles })).rejects.toThrow(/admin/i);
      await expect(listRevisions("home", "default", roles)).rejects.toThrow(/admin/i);
    }
  });

  it("saves a draft with server-made ids and audits it", async () => {
    const saved = await saveDraft({ key: "home", scope: "default", blocks: [rich("<p>Hi</p>", { id: "client-id" })], ...admin });
    expect(saved.blocks).toHaveLength(1);
    expect(saved.blocks[0].id).not.toBe("client-id");
    expect(await getDraft("home", "default")).toHaveLength(1);
    expect(await getPublished("home", "default")).toBeNull();
    expect(await AuditEvent.countDocuments({ action: "layout.save" })).toBe(1);
  });

  it("refuses to remove a block that cannot be deleted", async () => {
    const first = await saveDraft({ key: "listing", scope: "default", blocks: listing(), ...admin });
    const [header, feed] = first.blocks;
    // Removing the feed is refused.
    await expect(saveDraft({ key: "listing", scope: "default", blocks: [header], ...admin })).rejects.toThrow(/required/i);
    // Keeping both and editing text is fine.
    const edited = [
      { ...header, props: { ...header.props, h1Template: "{category}" } },
      { ...feed, props: { ...feed.props, emptyTitle: "Nothing yet" } },
    ];
    const again = await saveDraft({ key: "listing", scope: "default", blocks: edited, ...admin });
    expect(again.blocks.map((b) => b.id)).toEqual([header.id, feed.id]);
  });

  it("publish bumps the version and writes exactly one revision per publish", async () => {
    await saveDraft({ key: "home", scope: "default", blocks: [rich("one")], ...admin });
    const first = await publish({ key: "home", scope: "default", note: "first", ...admin });
    expect(first.version).toBe(1);
    expect(await PageLayoutRevision.countDocuments({ key: "home", scope: "default" })).toBe(1);
    expect(await getPublished("home", "default")).toHaveLength(1);

    await saveDraft({ key: "home", scope: "default", blocks: [rich("one"), rich("two")], ...admin });
    const second = await publish({ key: "home", scope: "default", ...admin });
    expect(second.version).toBe(2);
    expect(await PageLayoutRevision.countDocuments({ key: "home", scope: "default" })).toBe(2);
    const revisions = await listRevisions("home", "default", admin.roles);
    expect(revisions.map((r) => r.version)).toEqual([2, 1]);
    expect(await AuditEvent.countDocuments({ action: "layout.publish" })).toBe(2);
  });

  it("keeps revisions append-only", async () => {
    await saveDraft({ key: "home", scope: "default", blocks: [rich("one")], ...admin });
    await publish({ key: "home", scope: "default", ...admin });
    await expect(PageLayoutRevision.updateOne({ key: "home" }, { $set: { note: "changed" } })).rejects.toThrow(/append-only/);
    await expect(PageLayoutRevision.deleteMany({})).rejects.toThrow(/append-only/);
    const doc = await PageLayoutRevision.findOne({ key: "home" });
    doc!.note = "edited";
    await expect(doc!.save()).rejects.toThrow(/append-only/);
  });

  it("restores an old revision into the draft without publishing it", async () => {
    await saveDraft({ key: "home", scope: "default", blocks: [rich("v1")], ...admin });
    await publish({ key: "home", scope: "default", ...admin });
    await saveDraft({ key: "home", scope: "default", blocks: [rich("v2")], ...admin });
    await publish({ key: "home", scope: "default", ...admin });
    const restored = await restore({ key: "home", scope: "default", version: 1, ...admin });
    expect(restored.blocks[0].props.body).toBe("v1");
    expect((await getDraft("home", "default"))![0].props.body).toBe("v1");
    expect((await getPublished("home", "default"))![0].props.body).toBe("v2");
  });

  it("rejects scopes that a page may not use", async () => {
    await expect(saveDraft({ key: "home", scope: "category:property", blocks: [], ...admin })).rejects.toThrow(/default/i);
    await expect(saveDraft({ key: "listing", scope: "weird", blocks: [], ...admin })).rejects.toThrow(/scope/i);
    await expect(saveDraft({ key: "listing", scope: "url:/property/surat/", blocks: [], ...admin })).resolves.toBeDefined();
  });
});

describe("page reads", () => {
  it("falls back from url to category to default scope", async () => {
    const put = async (scope: string, body: string) => {
      await saveDraft({ key: "listing", scope, blocks: [...listing(), rich(body)], ...admin });
      await publish({ key: "listing", scope, ...admin });
    };
    await put("default", "default-text");
    await put("category:property", "category-text");
    await put("url:/property/surat/", "url-text");
    const body = async (scopes: string[]) => (await getPageBlocks("listing", scopes))!.find((b) => b.type === "richText")!.props.body;
    expect(await body(["url:/property/surat/", "category:property", "default"])).toBe("url-text");
    expect(await body(["url:/property/pune/", "category:property", "default"])).toBe("category-text");
    expect(await body(["url:/jobs/pune/", "category:jobs", "default"])).toBe("default-text");
  });

  it("returns null when nothing is published", async () => {
    await saveDraft({ key: "home", scope: "default", blocks: [rich("draft only")], ...admin });
    expect(await getPageBlocks("home", ["default"])).toBeNull();
  });

  it("hides hidden blocks and blocks outside their date window", async () => {
    await saveDraft({
      key: "home",
      scope: "default",
      blocks: [
        rich("always"),
        rich("hidden", { visible: false }),
        rich("future", { startsAt: "2030-01-01T00:00:00Z" }),
        rich("expired", { endsAt: "2020-01-01T00:00:00Z" }),
        rich("now", { startsAt: "2020-01-01T00:00:00Z", endsAt: "2030-01-01T00:00:00Z" }),
      ],
      ...admin,
    });
    await publish({ key: "home", scope: "default", ...admin });
    const shown = await getPageBlocks("home", ["default"], new Date("2026-11-11T00:00:00Z"));
    expect(shown!.map((b) => b.props.body)).toEqual(["always", "now"]);
  });

  it("publishing clears the cached read", async () => {
    await saveDraft({ key: "home", scope: "default", blocks: [rich("old")], ...admin });
    await publish({ key: "home", scope: "default", ...admin });
    expect((await getPageBlocks("home", ["default"]))![0].props.body).toBe("old");
    await saveDraft({ key: "home", scope: "default", blocks: [rich("new")], ...admin });
    await publish({ key: "home", scope: "default", ...admin });
    expect((await getPageBlocks("home", ["default"]))![0].props.body).toBe("new");
  });

  it("checks date windows with inWindow", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    expect(inWindow({}, now)).toBe(true);
    expect(inWindow({ startsAt: "2026-07-01T00:00:00Z" }, now)).toBe(false);
    expect(inWindow({ endsAt: "2026-06-01T00:00:00Z" }, now)).toBe(false);
    expect(inWindow({ startsAt: "2026-05-01T00:00:00Z", endsAt: "2026-07-01T00:00:00Z" }, now)).toBe(true);
  });
});
