import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ token: undefined as string | undefined, roles: ["admin"] as string[] }));

vi.mock("next/headers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/headers")>()),
  cookies: async () => ({ get: (name: string) => (name === "sid" && state.token ? { name, value: state.token } : undefined) }),
  headers: async () => new Headers(),
}));
vi.mock("@/lib/admin-auth", () => ({
  getStaffFromHeaders: async () => ({ verified: true, kind: "person", email: "staff@example.com", name: "Staff", roles: state.roles }),
  isStaff: (identity: { verified: boolean; roles: string[] }) => identity.verified && identity.roles.length > 0,
}));
vi.mock("@/lib/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/cache")>()),
  refreshPublicCache: async () => undefined,
}));
import { saveFreeAdsForAdmin, saveLandingForAdmin, saveTagsForAdmin } from "@/app/admin/growth-actions";
import { addRedirectAction, deleteRedirectAction, saveOverrideAction, savePrefixesAction } from "@/app/admin/url-actions";
import { hashToken } from "@/server/auth/http";
import { AuditEvent, Redirect, Session, Site, UrlOverride, User } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

async function signIn(roles: string[]) {
  state.roles = roles;
  const user = await User.create({
    email: `staff-${Math.random().toString(36).slice(2, 8)}@example.com`,
    passwordHash: "hash",
    displayName: "Staff",
    dateOfBirth: new Date("1990-01-01"),
    attestedAdultAt: new Date(),
    emailVerifiedAt: new Date(),
    roles,
    verificationStatus: "approved",
    status: "active",
  });
  state.token = `tok-${user._id}`;
  await Session.create({ userId: user._id, tokenHash: hashToken(state.token), expiresAt: new Date(Date.now() + 86_400_000) });
  return String(user._id);
}

const landing = { key: "dating|gurgaon", h1: "Dating in Gurgaon", intro: "Meet people in Gurgaon.", faqs: [{ q: "Is it free?", a: "Yes." }] };

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
  await AuditEvent.init();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
  state.token = undefined;
  await Site.create({ key: "default", name: "Tharkoo" });
});

describe("growth actions write an audit row", () => {
  it("saves a landing text, and audits it", async () => {
    const actorId = await signIn(["admin"]);
    const saved = await saveLandingForAdmin(landing);
    expect(saved.ok).toBe(true);
    const row = await AuditEvent.findOne({ action: "landing.save" }).lean();
    expect(row).toMatchObject({ targetType: "landing", targetId: "dating|gurgaon", actorRole: "admin" });
    expect(String(row?.actorId)).toBe(actorId);
    const site = (await Site.findOne({ key: "default" }).lean()) as { landings?: Record<string, unknown> } | null;
    expect(Object.keys(site?.landings ?? {})).toEqual(["dating|gurgaon"]);
    expect(await AuditEvent.countDocuments({ action: "landing.save" })).toBe(1);
  });

  it("audits the tags and the free ads per week", async () => {
    await signIn(["admin"]);
    expect(await saveTagsForAdmin("fun,Fun things\nnew,New")).toMatchObject({ ok: true, count: 2 });
    expect(await saveFreeAdsForAdmin(3)).toMatchObject({ ok: true, freeAdsPerWeek: 3 });
    expect(await AuditEvent.countDocuments({ action: "tags.save" })).toBe(1);
    const row = await AuditEvent.findOne({ action: "freeads.save" }).lean();
    expect(row?.after).toEqual({ freeAdsPerWeek: 3 });
  });

  it("refuses a role that is not admin and writes nothing", async () => {
    await signIn(["seo_editor"]);
    expect(await saveFreeAdsForAdmin(3)).toMatchObject({ ok: false });
    expect(await saveLandingForAdmin(landing)).toMatchObject({ ok: false });
    expect(await AuditEvent.countDocuments({ action: { $in: ["freeads.save", "landing.save"] } })).toBe(0);
  });
});

describe("URL actions write an audit row", () => {
  it("audits a redirect added and deleted, and the prefixes", async () => {
    await signIn(["admin"]);
    expect(await addRedirectAction("/old-page/", "/new-page/")).toMatchObject({ ok: true });
    const row = await AuditEvent.findOne({ action: "urls.redirect.add" }).lean();
    expect(row).toMatchObject({ targetType: "redirect", targetId: "/old-page/" });
    const redirect = await Redirect.findOne({}).lean();
    expect(await deleteRedirectAction(String(redirect?._id))).toMatchObject({ ok: true });
    expect(await AuditEvent.countDocuments({ action: "urls.redirect.delete" })).toBe(1);
    expect(await savePrefixesAction({})).toMatchObject({ ok: true });
    expect(await AuditEvent.countDocuments({ action: "urls.prefixes" })).toBe(1);
  });

  it("saves a page title override and audits it", async () => {
    await signIn(["admin"]);
    expect(await saveOverrideAction({ path: "/dating/", title: "Dating ads" })).toMatchObject({ ok: true });
    expect(await UrlOverride.countDocuments({})).toBe(1);
    expect(await AuditEvent.countDocuments({ action: "urls.override" })).toBe(1);
  });

  it("refuses a non-admin on every write", async () => {
    await signIn(["finance"]);
    expect(await addRedirectAction("/a/", "/b/")).toMatchObject({ ok: false });
    expect(await Redirect.countDocuments({})).toBe(0);
    expect(await AuditEvent.countDocuments({ action: /^urls\./ })).toBe(0);
  });
});
