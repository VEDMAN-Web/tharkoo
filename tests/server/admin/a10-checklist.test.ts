import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildChecklist, getLaunchChecklist, looksLikeJunk, nationalDigits, placeholderPagesIn, tickChecklist, type ChecklistInputs } from "@/server/admin/launch-checklist";
import { AuditEvent, Page, Site } from "@/server/models";
import { ForbiddenError, NotFoundError } from "@/server/http";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const BASE: ChecklistInputs = {
  staffNames: ["Vedant", "Ayesha"],
  mockPaymentsOn: false,
  paidPostingOn: true,
  postingFee: 30,
  demoActive: 0,
  junkTitles: ["Coffee and a walk"],
  supportPhone: "+91 9123456789",
  placeholderPages: [],
  grievancePublished: true,
  bannerChangedAt: new Date("2026-11-16T10:00:00Z"),
  pictures: 22,
  picturesToCheck: 0,
  loginCodeWarning: null,
  siteHidden: false,
  ticks: {},
};

const row = (inputs: ChecklistInputs, id: string) => buildChecklist(inputs).find((item) => item.id === id)!;

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});

describe("launch checklist rules (A10)", () => {
  it("has the 11 rows of the mockup, in order (no office address row)", () => {
    expect(buildChecklist(BASE).map((item) => item.title)).toEqual([
      "Staff sign-in works",
      "Test payments OFF and a real gateway connected",
      "Decide paid posting",
      "End demo ads, or keep them",
      "Remove junk test ads",
      "Real 10-digit support phone",
      "Banner picture checked against the content rules",
      "Home, category and city photos with alt text",
      "Legal pages and grievance officer",
      "Login-code email test",
      "Show the site to Google",
    ]);
  });

  it("test payments are done only when they are off", () => {
    expect(row(BASE, "test-payments")).toMatchObject({ done: true, detail: "Test payments are off" });
    expect(row({ ...BASE, mockPaymentsOn: true }, "test-payments")).toMatchObject({ done: false, detail: "Test payments are ON today" });
  });

  it("the money rows open Prices & plans", () => {
    expect(row(BASE, "test-payments").href).toBe("/admin/prices/");
    expect(row(BASE, "paid-posting").href).toBe("/admin/prices/");
  });

  it("demo ads are done only when none are live", () => {
    expect(row(BASE, "demo-ads").done).toBe(true);
    expect(row({ ...BASE, demoActive: 8228 }, "demo-ads")).toMatchObject({ done: false, detail: "8,228 demo ads are live" });
  });

  it("the support phone needs 10 digits after +91", () => {
    expect(nationalDigits("+91 9123456789")).toBe("9123456789");
    expect(nationalDigits("+91 912345678")).toBe("912345678");
    expect(row(BASE, "support-phone").done).toBe(true);
    expect(row({ ...BASE, supportPhone: "+91 912345678" }, "support-phone")).toMatchObject({ done: false, detail: "Now +91 912345678 (9 digits)" });
  });

  it("with no support phone saved the row says so and stays open", () => {
    expect(row({ ...BASE, supportPhone: "" }, "support-phone")).toMatchObject({ done: false, detail: "No number saved yet" });
  });

  it("a placeholder on any legal page keeps the legal row open and there is no office address row", () => {
    const pages = placeholderPagesIn([
      { name: "The Safety page", text: "Postal address: [placeholder: add address]." },
      { name: "The Terms page", text: "Fine." },
    ]);
    expect(pages).toEqual(["The Safety page"]);
    const withPlaceholder = { ...BASE, placeholderPages: pages };
    expect(buildChecklist(withPlaceholder).some((item) => item.id === "office-address")).toBe(false);
    expect(row(withPlaceholder, "legal").done).toBe(false);
    expect(row({ ...BASE, grievancePublished: false }, "legal")).toMatchObject({ done: false, detail: "The grievance page is not published" });
  });

  it("the site is shown to Google only when it is no longer hidden", () => {
    expect(row({ ...BASE, siteHidden: true }, "google").done).toBe(false);
    expect(row(BASE, "google").done).toBe(true);
  });

  it("pictures, staff and the login email are computed", () => {
    expect(row({ ...BASE, picturesToCheck: 3 }, "photos")).toMatchObject({ done: false });
    expect(row({ ...BASE, pictures: 0 }, "photos").done).toBe(false);
    expect(row({ ...BASE, staffNames: [] }, "staff").done).toBe(false);
    expect(row({ ...BASE, loginCodeWarning: "No provider" }, "login-email").done).toBe(false);
  });

  it("the three manual rows follow their ticks and say which key they save", () => {
    const ticked = { ...BASE, ticks: { junkAdsChecked: { by: "a" }, bannerChecked: null } };
    expect(row(ticked, "junk-ads")).toMatchObject({ done: true, manual: "junkAdsChecked" });
    expect(row(ticked, "banner")).toMatchObject({ done: false, manual: "bannerChecked" });
    expect(row(ticked, "paid-posting")).toMatchObject({ done: false, manual: "paidPostingDecided" });
    expect(buildChecklist(BASE).filter((item) => item.manual).length).toBe(3);
  });

  it("spots junk titles by length or no vowels, and names one", () => {
    expect(looksLikeJunk("htjkjjhhkh")).toBe(true);
    expect(looksLikeJunk("ab")).toBe(true);
    expect(looksLikeJunk("Coffee and a walk")).toBe(false);
    expect(row({ ...BASE, junkTitles: ["Coffee and a walk", "htjkjjhhkh"] }, "junk-ads").detail).toBe("1 look like junk, for example “htjkjjhhkh”");
  });
});

describe("ticking a manual row (A10)", () => {
  const admin = { actorId: new mongoose.Types.ObjectId().toString(), email: "admin@example.test", roles: ["admin"], requestId: "req" };

  it("saves the tick, writes one audit row with a summary, and the row stays done after a reload", async () => {
    await Site.create({ key: "default" });
    await tickChecklist(admin, "bannerChecked", true);
    const site = await Site.findOne({ key: "default" }).lean<{ launchChecklist?: { bannerChecked?: { by?: string } | null } }>();
    expect(site?.launchChecklist?.bannerChecked?.by).toBe("admin@example.test");
    const audit = await AuditEvent.find({ action: "launch.tick" }).lean<{ summary?: string; targetLabel?: string }[]>();
    expect(audit).toHaveLength(1);
    expect(audit[0].summary).toBe("Ticked the “banner picture checked” row");
    expect(audit[0].targetLabel).toBe("Launch checklist");
    const reloaded = await getLaunchChecklist();
    expect(reloaded.find((item) => item.id === "banner")?.done).toBe(true);
    await tickChecklist(admin, "bannerChecked", false);
    expect((await getLaunchChecklist()).find((item) => item.id === "banner")?.done).toBe(false);
    expect(await AuditEvent.countDocuments({ action: "launch.untick" })).toBe(1);
  });

  it("refuses a role without the settings permission, and a key that is not a manual row", async () => {
    await expect(tickChecklist({ ...admin, roles: ["moderator"] }, "bannerChecked", true)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(tickChecklist(admin, "staff", true)).rejects.toBeInstanceOf(NotFoundError);
    expect(await Site.countDocuments({ "launchChecklist.bannerChecked": { $ne: null } })).toBe(0);
  });

  it("reads the real data: an unpublished grievance page and a placeholder in a published page", async () => {
    await Page.create({ slug: "about", title: "About", body: "Postal address: [placeholder: add].", status: "published" });
    const list = await getLaunchChecklist();
    expect(list.find((item) => item.id === "legal")).toMatchObject({ done: false, detail: "The grievance page is not published" });
    expect(list.some((item) => item.id === "office-address")).toBe(false);
  });
});
