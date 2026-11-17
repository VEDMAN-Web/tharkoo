import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditEvent, Site, User } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";
import { defaultSiteContent, isAdminRole, readContent, sanitizeSiteContent } from "@/lib/ui/site-content";
import { applyHomepageChange, ensureHomepageDocument, HOME_MOVED_MESSAGE } from "@/lib/ui/site-store";
import { safeNext } from "@/lib/ui/api";
import { peoplePortraits } from "@/lib/media";

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

describe("homepage content", () => {
  it("uses the current homepage when nothing is stored", () => {
    const content = readContent(undefined);
    expect(content.hero.desktop).toBe("Find anything near you");
    expect(content.hero.searchPlaceholder).toBe("Search By City, Category...");
    expect(content.cards.filter((card) => card.visible)).toHaveLength(5);
    expect(content.header.drawer.map((item) => item.label)).toEqual(["Tharkoo Blog", "Help Center"]);
    expect(readContent({ blocks: [] }).cardsHeading).toBe("Latest listings in your city");
  });

  it("rejects an unsafe link and an unsafe photo", () => {
    const badLink = sanitizeSiteContent({
      ...defaultSiteContent(),
      header: { ...defaultSiteContent().header, drawer: [{ label: "Bad", href: "javascript:alert(1)", visible: true }] },
    });
    expect(badLink.ok).toBe(false);
    const badPhoto = sanitizeSiteContent({
      ...defaultSiteContent(),
      hero: { ...defaultSiteContent().hero, photo: "javascript:alert(1)" },
    });
    expect(badPhoto.ok).toBe(false);
    const locked = sanitizeSiteContent({
      ...defaultSiteContent(),
      hero: { ...defaultSiteContent().hero, postHref: "https://example.com/out" },
    });
    expect(locked.ok).toBe(false);
  });

  it("keeps a safe headline and strips markup", () => {
    const parsed = sanitizeSiteContent({
      ...defaultSiteContent(),
      hero: { ...defaultSiteContent().hero, desktop: "Hello <b>there</b>" },
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.content.hero.desktop).toBe("Hello there");
  });

  it("allows only admin roles", () => {
    expect(isAdminRole(["admin"])).toBe(true);
    expect(isAdminRole(["superadmin"])).toBe(true);
    expect(isAdminRole(["moderator"])).toBe(false);
    expect(isAdminRole(["user"])).toBe(false);
  });

  it("saves for an admin, audits the change, and refuses other staff", async () => {
    await User.create({
      email: "owner@example.test",
      passwordHash: "hash",
      displayName: "Owner",
      dateOfBirth: new Date("1990-01-01"),
      attestedAdultAt: new Date(),
      roles: ["admin"],
      status: "active",
    });
    await expect(
      applyHomepageChange({ roles: ["moderator"], email: "mod@example.test", content: defaultSiteContent() }),
    ).rejects.toThrow(/Only an admin/);
    const saved = await applyHomepageChange({
      roles: ["admin"],
      email: "owner@example.test",
      content: { ...defaultSiteContent(), seoTitle: "Edited home title" },
    });
    expect(saved.seoTitle).toBe("Edited home title");
    const site = await Site.findOne({ key: "default" }).lean();
    expect(readContent(site?.homepage).seoTitle).toBe("Edited home title");
    const events = await AuditEvent.find({ action: "site.homepage.update" }).lean();
    expect(events).toHaveLength(1);
    expect(String(events[0]?.actorType)).toBe("admin");
  });

  it("refuses the old Home writers with a message that points to the Page builder (H8.19)", async () => {
    await ensureHomepageDocument();
    const base = defaultSiteContent();
    const other = { roles: ["admin"], email: "owner@example.test" };
    await expect(applyHomepageChange({ ...other, content: { ...base, hero: { ...base.hero, desktop: "Edited headline" } } })).rejects.toThrow(HOME_MOVED_MESSAGE);
    await expect(applyHomepageChange({ ...other, content: { ...base, homeCategoriesCount: 6 } })).rejects.toThrow(/Page builder/);
    await expect(applyHomepageChange({ ...other, content: { ...base, cards: base.cards.slice(1) } })).rejects.toThrow(/Page builder/);
    await expect(applyHomepageChange({ ...other, content: null, reset: true })).rejects.toThrow(/Page builder/);
    const site = await Site.findOne({ key: "default" }).lean();
    expect(readContent(site?.homepage).hero.desktop).toBe(base.hero.desktop);
    expect(await AuditEvent.countDocuments({ action: { $in: ["site.homepage.update", "site.homepage.reset"] } })).toBe(0);
  });

  it("still saves what the Page builder does not own: the Home title, the login picture and the listing band (H8.19)", async () => {
    await ensureHomepageDocument();
    const base = defaultSiteContent();
    const saved = await applyHomepageChange({ roles: ["admin"], email: "owner@example.test", content: { ...base, loginImage: "/placeholders/login.webp", showListingBand: true } });
    expect(saved).toMatchObject({ loginImage: "/placeholders/login.webp", showListingBand: true });
  });
});

describe("people portraits", () => {
  it("rotates four different portraits by ad id", () => {
    const first = peoplePortraits("dating", "demo-1300");
    expect(first).toHaveLength(4);
    expect(new Set(first).size).toBe(4);
    expect(first?.every((src) => src.startsWith("/placeholders/profiles/"))).toBe(true);
    expect(peoplePortraits("dating", "demo-1300")).toEqual(first);
    const shifted = Array.from({ length: 12 }, (_, index) => peoplePortraits("friendship", `ad-${index}`)?.[0]);
    expect(new Set(shifted).size).toBeGreaterThan(1);
    expect(peoplePortraits("jobs", "demo-1300")).toBeNull();
  });
});

describe("safe next path", () => {
  it("allows a relative return path and blocks open redirects", () => {
    expect(safeNext("/u/post-insert/")).toBe("/u/post-insert/");
    expect(safeNext("/u/post-insert/?draft=abc")).toBe("/u/post-insert/?draft=abc");
    expect(safeNext("https://evil.example/phish")).toBeNull();
    expect(safeNext("//evil.example")).toBeNull();
    expect(safeNext("/%2F%2Fevil.example")).toBeNull();
    expect(safeNext("/\\evil.example")).toBeNull();
    expect(safeNext("javascript:alert(1)")).toBeNull();
    expect(safeNext("/u/post-insert/\n/evil")).toBeNull();
  });
});
