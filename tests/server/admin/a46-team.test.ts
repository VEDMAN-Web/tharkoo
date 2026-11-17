import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const sent: { to: string; subject: string; text: string }[] = [];
const mailState = { fail: false };
vi.mock("@/server/mailer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/mailer")>()),
  mailerFromEnv: () => ({
    send: async (mail: { to: string; subject: string; text: string }) => {
      if (mailState.fail) throw new Error("mail down");
      sent.push(mail);
    },
  }),
}));

import { guideFor } from "@/app/admin/team/_team/guide";
import type { AdminCtx } from "@/server/admin/context";
import { anotherSuperadminExists, changeRoles, inviteStaff, listStaff, removeAccess, resendInvite } from "@/server/admin/team";
import { undoEvent } from "@/server/admin/undo/core";
import { loginUser, resetPassword } from "@/server/auth/service";
import { ConflictError, ForbiddenError, ValidationError } from "@/server/http";
import { AuditEvent, PasswordResetToken, Session, User } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

let counter = 0;

async function person(name: string, roles: string[], extra: Record<string, unknown> = {}) {
  return User.create({ email: `p${++counter}@example.com`, passwordHash: "x", displayName: name, roles, verificationStatus: "unsubmitted", status: "active", dateOfBirth: new Date("1990-01-01"), attestedAdultAt: new Date("2020-01-01"), emailVerifiedAt: new Date(), ...extra });
}

function ctxOf(user: { _id: unknown; email: string; roles: string[] }): AdminCtx {
  return { actorId: String(user._id), email: user.email, roles: [...user.roles], requestId: `r-${counter}` };
}

const rolesOf = async (id: unknown) => (await User.findById(id).lean())!.roles;

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
  sent.length = 0;
  mailState.fail = false;
});

describe("the staff list", () => {
  it("lists only staff, shows who is invited and who is you, and the newest sign-in", async () => {
    const boss = await person("Vedant", ["superadmin"]);
    const mod = await person("Ayesha", ["user", "moderator", "trust_safety"]);
    await person("Customer", ["user"]);
    await person("Gone", ["support"], { status: "deleted" });
    await Session.create({ userId: mod._id, tokenHash: "t1", expiresAt: new Date(Date.now() + 1e7), createdAt: new Date("2026-11-10T10:00:00Z") });
    await Session.create({ userId: mod._id, tokenHash: "t2", expiresAt: new Date(Date.now() + 1e7), createdAt: new Date("2026-11-12T10:00:00Z") });
    const rows = await listStaff(boss.email.toUpperCase());
    expect(rows.map((row) => row.name)).toEqual(["Ayesha", "Vedant"]);
    expect(rows[0]).toMatchObject({ roles: ["moderator", "trust_safety"], invited: false, isYou: false, lastSignIn: "2026-11-12T10:00:00.000Z" });
    expect(rows[1]).toMatchObject({ roles: ["superadmin"], invited: true, isYou: true, lastSignIn: null });
  });
});

describe("invite", () => {
  it("makes the account, emails a link that lets them choose a password and sign in, and keeps the link out of the audit", async () => {
    const boss = await person("Vedant", ["superadmin"]);
    const done = await inviteStaff(ctxOf(boss), { name: "Kavya", email: " Kavya@Example.com ", roles: ["blog_editor"] });
    expect(done).toMatchObject({ emailed: true, undoUntil: null });
    const user = await User.findById(done.userId).select("+passwordHash").lean();
    expect(user).toMatchObject({ email: "kavya@example.com", displayName: "Kavya", roles: ["blog_editor"], status: "active" });
    expect(user!.passwordHash).toBeTruthy();
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("kavya@example.com");
    const token = /token=([0-9a-f]{64})/.exec(sent[0].text)![1];
    const rows = await AuditEvent.find({ action: "team.invite" }).lean<{ lock?: string; after?: unknown; undo?: unknown }[]>();
    expect(rows).toHaveLength(1);
    expect(rows[0].lock).toBe("message_sent");
    expect(JSON.stringify(rows[0])).not.toContain(token);
    await expect(loginUser({ email: "kavya@example.com", password: "Anything1!" })).rejects.toThrow();
    await resetPassword(token, "Chosen-Pass-1!");
    const session = await loginUser({ email: "kavya@example.com", password: "Chosen-Pass-1!" });
    expect(session).toBeTruthy();
    await expect(resetPassword(token, "Another-Pass-1!")).rejects.toThrow();
  });

  it("refuses an email that already has an account, a bad email, no role and an unknown role", async () => {
    const boss = await person("Vedant", ["superadmin"]);
    const customer = await person("Customer", ["user"]);
    const ctx = ctxOf(boss);
    await expect(inviteStaff(ctx, { name: "X", email: customer.email, roles: ["support"] })).rejects.toBeInstanceOf(ConflictError);
    await expect(inviteStaff(ctx, { name: "X", email: "not-an-email", roles: ["support"] })).rejects.toBeInstanceOf(ValidationError);
    await expect(inviteStaff(ctx, { name: "", email: "a@example.com", roles: ["support"] })).rejects.toBeInstanceOf(ValidationError);
    await expect(inviteStaff(ctx, { name: "X", email: "a@example.com", roles: [] })).rejects.toBeInstanceOf(ValidationError);
    await expect(inviteStaff(ctx, { name: "X", email: "a@example.com", roles: ["owner"] })).rejects.toBeInstanceOf(ValidationError);
    expect(await User.countDocuments({ email: "a@example.com" })).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it("needs a reason to invite a superadmin, and only a superadmin may invite at all (the refusal is audited)", async () => {
    const boss = await person("Vedant", ["superadmin"]);
    await expect(inviteStaff(ctxOf(boss), { name: "Big", email: "big@example.com", roles: ["superadmin"] })).rejects.toBeInstanceOf(ValidationError);
    await expect(inviteStaff(ctxOf(boss), { name: "Big", email: "big@example.com", roles: ["superadmin"], reason: "Co-owner" })).resolves.toMatchObject({ emailed: true });
    const admin = await person("Anil", ["admin"]);
    await expect(inviteStaff(ctxOf(admin), { name: "Z", email: "z@example.com", roles: ["support"] })).rejects.toBeInstanceOf(ForbiddenError);
    expect(await User.countDocuments({ email: "z@example.com" })).toBe(0);
    expect(await AuditEvent.countDocuments({ action: "admin.write.denied" })).toBe(1);
  });

  it("keeps the account when the email fails and says so, and Send again replaces the older link", async () => {
    const boss = await person("Vedant", ["superadmin"]);
    mailState.fail = true;
    const done = await inviteStaff(ctxOf(boss), { name: "Meera", email: "meera@example.com", roles: ["seo_editor"] });
    expect(done.emailed).toBe(false);
    expect(done.summary).toContain("did not go");
    expect(await User.countDocuments({ email: "meera@example.com" })).toBe(1);
    mailState.fail = false;
    const again = await resendInvite(ctxOf(boss), { userId: done.userId });
    expect(again.emailed).toBe(true);
    expect(sent).toHaveLength(1);
    const open = await PasswordResetToken.countDocuments({ userId: done.userId, usedAt: null });
    expect(open).toBe(1);
    const row = await AuditEvent.findOne({ action: "team.invite.resend" }).lean<{ lock?: string }>();
    expect(row?.lock).toBe("message_sent");
  });
});

describe("change roles", () => {
  it("changes only the staff roles, keeps the ordinary roles, and undo, a second undo and redo work from the saved roles", async () => {
    const boss = await person("Vedant", ["superadmin"]);
    const ayesha = await person("Ayesha", ["user", "moderator"]);
    const done = await changeRoles(ctxOf(boss), { userId: String(ayesha._id), roles: ["support", "finance"] });
    expect((await rolesOf(ayesha._id)).sort()).toEqual(["finance", "support", "user"]);
    expect((await rolesOf(ayesha._id)).includes("moderator")).toBe(false);
    const undone = await undoEvent(ctxOf(boss), done.eventId);
    expect(undone.ok).toBe(true);
    expect(await rolesOf(ayesha._id)).toEqual(["user", "moderator"]);
    expect(await undoEvent(ctxOf(boss), done.eventId)).toMatchObject({ ok: false, reason: "already_undone" });
    if (!undone.ok) throw new Error("undo failed");
    const redo = await undoEvent(ctxOf(boss), undone.eventId);
    expect(redo.ok).toBe(true);
    expect((await rolesOf(ayesha._id)).sort()).toEqual(["finance", "support", "user"]);
  });

  it("refuses undo when the roles were changed again, and refuses the same roles, own roles and a customer", async () => {
    const boss = await person("Vedant", ["superadmin"]);
    const other = await person("Other", ["superadmin"]);
    const ayesha = await person("Ayesha", ["moderator"]);
    const first = await changeRoles(ctxOf(boss), { userId: String(ayesha._id), roles: ["support"] });
    await changeRoles(ctxOf(other), { userId: String(ayesha._id), roles: ["finance"] });
    expect(await undoEvent(ctxOf(boss), first.eventId)).toMatchObject({ ok: false, reason: "conflict" });
    expect(await rolesOf(ayesha._id)).toEqual(["finance"]);
    await expect(changeRoles(ctxOf(boss), { userId: String(ayesha._id), roles: ["finance"] })).rejects.toBeInstanceOf(ConflictError);
    await expect(changeRoles(ctxOf(boss), { userId: String(boss._id), roles: ["admin"], reason: "x" })).rejects.toBeInstanceOf(ForbiddenError);
    const customer = await person("Customer", ["user"]);
    await expect(changeRoles(ctxOf(boss), { userId: String(customer._id), roles: ["support"] })).rejects.toBeInstanceOf(ConflictError);
    await expect(changeRoles(ctxOf(boss), { userId: "nope", roles: ["support"] })).rejects.toThrow();
  });

  it("needs a reason when a superadmin role is given or taken, and an admin cannot change roles", async () => {
    const boss = await person("Vedant", ["superadmin"]);
    const other = await person("Other", ["superadmin"]);
    const ayesha = await person("Ayesha", ["moderator"]);
    await expect(changeRoles(ctxOf(boss), { userId: String(ayesha._id), roles: ["superadmin"] })).rejects.toBeInstanceOf(ValidationError);
    await changeRoles(ctxOf(boss), { userId: String(ayesha._id), roles: ["superadmin"], reason: "Co-owner" });
    await expect(changeRoles(ctxOf(boss), { userId: String(other._id), roles: ["admin"] })).rejects.toBeInstanceOf(ValidationError);
    const admin = await person("Anil", ["admin"]);
    await expect(changeRoles(ctxOf(admin), { userId: String(ayesha._id), roles: ["support"] })).rejects.toBeInstanceOf(ForbiddenError);
    expect(await rolesOf(ayesha._id)).toEqual(["superadmin"]);
  });
});

describe("the last superadmin", () => {
  it("cannot lose the role by Change role, Remove access or undo while nobody else is an active superadmin", async () => {
    const lone = await person("Lone", ["superadmin"]);
    const banned = await person("Banned", ["superadmin"], { status: "suspended" });
    const staleCtx = { ...ctxOf(banned), roles: ["superadmin"] };
    expect(await anotherSuperadminExists(String(lone._id))).toBe(false);
    expect(await anotherSuperadminExists(String(banned._id))).toBe(true);
    await expect(changeRoles(staleCtx, { userId: String(lone._id), roles: ["admin"], reason: "x" })).rejects.toThrow(/last superadmin/);
    await expect(removeAccess(staleCtx, { userId: String(lone._id), reason: "x" })).rejects.toThrow(/last superadmin/);
    expect(await rolesOf(lone._id)).toEqual(["superadmin"]);

    // With a second active superadmin the same change is allowed.
    const second = await person("Second", ["superadmin"]);
    const done = await changeRoles(ctxOf(second), { userId: String(lone._id), roles: ["admin"], reason: "Step down" });
    expect(await rolesOf(lone._id)).toEqual(["admin"]);

    // Undo gives the role back; a later undo of that (redo) would again leave Second as the only one, which is fine, but not when Second is gone.
    const back = await undoEvent(ctxOf(second), done.eventId);
    expect(back.ok).toBe(true);
    await User.updateOne({ _id: second._id }, { $set: { status: "suspended" } });
    if (!back.ok) throw new Error("undo failed");
    await expect(undoEvent(ctxOf(lone), back.eventId)).rejects.toThrow(/last superadmin/);
    expect(await rolesOf(lone._id)).toEqual(["superadmin"]);
  });
});

describe("remove access", () => {
  it("takes the staff roles, ends every sign-in, keeps the account as a user, and undo gives the roles back", async () => {
    const boss = await person("Vedant", ["superadmin"]);
    const rohan = await person("Rohan", ["support", "finance"]);
    await Session.create({ userId: rohan._id, tokenHash: "r1", expiresAt: new Date(Date.now() + 1e7) });
    await expect(removeAccess(ctxOf(boss), { userId: String(rohan._id) })).rejects.toBeInstanceOf(ValidationError);
    const done = await removeAccess(ctxOf(boss), { userId: String(rohan._id), reason: "Left the team" });
    expect(await rolesOf(rohan._id)).toEqual(["user"]);
    expect(await Session.countDocuments({ userId: rohan._id, revokedAt: { $exists: false } })).toBe(0);
    expect((await listStaff(boss.email)).map((row) => row.name)).toEqual(["Vedant"]);
    const row = await AuditEvent.findById(done.eventId).lean<{ summary?: string; before?: unknown; after?: unknown }>();
    expect(row?.summary).toContain("Rohan");
    expect(await undoEvent(ctxOf(boss), done.eventId)).toMatchObject({ ok: true });
    expect(await rolesOf(rohan._id)).toEqual(["support", "finance"]);
    expect(await undoEvent(ctxOf(boss), done.eventId)).toMatchObject({ ok: false, reason: "already_undone" });
  });

  it("an admin cannot undo a team change", async () => {
    const boss = await person("Vedant", ["superadmin"]);
    const admin = await person("Anil", ["admin"]);
    const rohan = await person("Rohan", ["support"]);
    const done = await removeAccess(ctxOf(boss), { userId: String(rohan._id), reason: "Left" });
    expect(await undoEvent(ctxOf(admin), done.eventId)).toMatchObject({ ok: false, reason: "not_allowed" });
    expect(await rolesOf(rohan._id)).toEqual(["user"]);
  });
});

describe("what each role can open", () => {
  it("is worked out from the real menu rules", () => {
    expect(guideFor("blog_editor")).toMatchObject({ opens: "Content studio, Media library", label: "Blog editor" });
    expect(guideFor("superadmin").opens).toBe("Everything");
    expect(guideFor("admin").opens).toBe("Everything except Settings, Team & roles");
    expect(guideFor("support").opens).toContain("Support desk");
    expect(guideFor("support").opens).not.toContain("Orders");
    for (const role of ["moderator", "trust_safety", "support", "finance", "seo_editor", "blog_editor", "admin", "superadmin"] as const) {
      const text = JSON.stringify(guideFor(role));
      expect(text).not.toMatch(/[–—]/);
      expect(text).not.toMatch(/\b(seller|vendor|buyer)\b/i);
    }
  });
});
