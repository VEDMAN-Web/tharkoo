import bcrypt from "bcryptjs";
import mongoose, { type Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { STAFF_ROLES, type StaffRole } from "@/lib/admin/perms";
import type { AdminCtx } from "@/server/admin/context";
import { adminWrite } from "@/server/admin/write";
import { siteOrigin } from "@/server/auth/http";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/http";
import { mailerFromEnv } from "@/server/mailer";
import { PasswordResetToken, Session, User } from "@/server/models";
import { STAFF_ROLE_NAMES } from "@/server/models/identity";
import { randomToken, sha256 } from "@/server/shared/crypto";

/**
 * H8.46 (A46): Team and roles. Superadmin only (perm team.edit).
 * Staff are users whose roles hold a staff role. Every write goes through adminWrite (permission, reason, blocked words, audit).
 * Role changes and Remove access can be undone from the saved roles only (undo kind team.roles). An invite email cannot be taken back.
 */

const INVITE_DAYS = 3;
const INVITE_MS = INVITE_DAYS * 24 * 60 * 60 * 1000;
const NAME_MAX = 60;
const EMAIL_MAX = 254;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const BCRYPT_ROUNDS = 10;

export type StaffRow = {
  id: string;
  name: string;
  email: string;
  roles: StaffRole[];
  status: "active" | "suspended" | "deleted";
  /** The newest sign-in, or null when they never signed in (still invited). */
  lastSignIn: string | null;
  invited: boolean;
  isYou: boolean;
};

export type TeamWrite = { eventId: string; undoUntil: string | null; summary: string };
export type InviteWrite = TeamWrite & { userId: string; emailed: boolean };

const isStaffName = (role: string): role is StaffRole => (STAFF_ROLES as readonly string[]).includes(role);

/** The staff roles of a person, in the order of the role list (so two lists compare equal). */
export function staffRolesOf(roles: readonly string[]): StaffRole[] {
  return STAFF_ROLES.filter((role) => roles.includes(role));
}

/** Roles that are not staff roles (user, seller) stay as they are when staff roles change. */
function otherRolesOf(roles: readonly string[]): string[] {
  return roles.filter((role) => !STAFF_ROLE_NAMES.has(role));
}

function cleanRoles(input: unknown): StaffRole[] {
  const list = Array.isArray(input) ? input.map(String) : [];
  const bad = list.filter((role) => !isStaffName(role));
  if (bad.length) throw new ValidationError("Choose roles from the list.");
  const roles = staffRolesOf(list);
  if (roles.length === 0) throw new ValidationError("Choose at least one role.");
  return roles;
}

export async function listStaff(viewerEmail: string): Promise<StaffRow[]> {
  await connectDb();
  const users = await User.find({ roles: { $in: [...STAFF_ROLES] }, status: { $ne: "deleted" } })
    .select("email displayName roles status")
    .sort({ displayName: 1, email: 1 })
    .lean<{ _id: Types.ObjectId; email: string; displayName: string; roles: string[]; status: StaffRow["status"] }[]>();
  const seen = await Session.aggregate<{ _id: Types.ObjectId; at: Date }>([
    { $match: { userId: { $in: users.map((user) => user._id) } } },
    { $group: { _id: "$userId", at: { $max: "$createdAt" } } },
  ]);
  const lastBy = new Map(seen.map((row) => [String(row._id), row.at]));
  return users.map((user) => {
    const at = lastBy.get(String(user._id));
    return {
      id: String(user._id),
      name: user.displayName,
      email: user.email,
      roles: staffRolesOf(user.roles),
      status: user.status,
      lastSignIn: at ? new Date(at).toISOString() : null,
      invited: !at,
      isYou: user.email === viewerEmail.trim().toLowerCase(),
    };
  });
}

/** True when somebody other than this person is an active superadmin. */
export async function anotherSuperadminExists(exceptUserId: string): Promise<boolean> {
  await connectDb();
  const count = await User.countDocuments({ roles: "superadmin", status: "active", _id: { $ne: new mongoose.Types.ObjectId(exceptUserId) } });
  return count > 0;
}

async function loadStaff(userId: string) {
  await connectDb();
  if (!mongoose.isValidObjectId(userId)) throw new NotFoundError("Not found");
  const user = await User.findById(userId);
  if (!user || user.status === "deleted") throw new NotFoundError("Not found");
  if (staffRolesOf(user.roles).length === 0) throw new ConflictError("This person is not on the team.");
  return user;
}

function wordsOf(roles: readonly string[]): string {
  return roles.length ? roles.join(", ").replace(/_/g, " ") : "no staff role";
}

async function setRoles(ctx: AdminCtx, input: { userId: string; staff: StaffRole[]; reason?: string; action: "team.roles" | "team.remove" }): Promise<TeamWrite> {
  const user = await loadStaff(input.userId);
  const id = String(user._id);
  if (id === ctx.actorId) throw new ForbiddenError("You cannot change your own access. Ask another superadmin.");
  const before = [...user.roles];
  const after = [...otherRolesOf(before), ...input.staff];
  if (input.action === "team.remove" && otherRolesOf(before).length === 0) after.push("user");
  const wasSuper = before.includes("superadmin");
  const willBeSuper = after.includes("superadmin");
  if (staffRolesOf(before).join() === staffRolesOf(after).join()) throw new ConflictError("Nothing changed.");
  if (wasSuper && !willBeSuper && !(await anotherSuperadminExists(id))) throw new ConflictError("This is the last superadmin. Make someone else a superadmin first.");
  const removing = input.action === "team.remove";
  const written = await adminWrite(ctx, {
    perm: "team.edit",
    action: input.action,
    target: { type: "user", id, label: user.displayName },
    reason: input.reason,
    reasonRequired: removing || wasSuper || willBeSuper,
    texts: [input.reason],
    undo: { kind: "team.roles", windowKey: "decisions" },
    before: async () => ({ roles: before }),
    apply: async () => {
      await User.updateOne({ _id: user._id }, { $set: { roles: after } });
      if (removing) await Session.updateMany({ userId: user._id, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
      return {
        after: { roles: after },
        result: null,
        undoData: { roles: before, expect: after },
        summary: removing ? `Removed staff access of ${user.displayName} (was ${wordsOf(staffRolesOf(before))})` : `Changed roles of ${user.displayName}: ${wordsOf(staffRolesOf(before))} to ${wordsOf(input.staff)}`,
      };
    },
  });
  return { eventId: written.eventId, undoUntil: written.undoUntil, summary: removing ? `${user.displayName} no longer has staff access` : `Roles of ${user.displayName} saved` };
}

/** Sets the staff roles of a person. A superadmin change needs a reason; the last superadmin cannot lose the role; nobody changes their own roles. */
export async function changeRoles(ctx: AdminCtx, input: { userId: string; roles: unknown; reason?: string }): Promise<TeamWrite> {
  await connectDb();
  return setRoles(ctx, { userId: String(input.userId), staff: cleanRoles(input.roles), reason: input.reason, action: "team.roles" });
}

/** Takes away every staff role and signs the person out everywhere. Their account stays as an ordinary user. */
export async function removeAccess(ctx: AdminCtx, input: { userId: string; reason?: string }): Promise<TeamWrite> {
  await connectDb();
  return setRoles(ctx, { userId: String(input.userId), staff: [], reason: input.reason, action: "team.remove" });
}

async function sendInviteMail(email: string, name: string, token: string): Promise<boolean> {
  try {
    await mailerFromEnv().send({
      to: email,
      subject: "You were invited to the Tharkoo admin",
      text: `Hi ${name}, you were invited to help run Tharkoo. Open ${siteOrigin()}/u/reset?token=${token} to choose a password. The link works for ${INVITE_DAYS} days.`,
    });
    return true;
  } catch (error) {
    console.error("admin.team.invite_mail_failed", error instanceof Error ? error.message : error);
    return false;
  }
}

async function newInviteToken(userId: Types.ObjectId): Promise<string> {
  const token = randomToken();
  await PasswordResetToken.create({ userId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + INVITE_MS) });
  return token;
}

/**
 * Invites a new staff member: makes the account with the roles and a password nobody knows, then emails a link to choose a password.
 * An email that already has an account is refused (customers and staff stay apart). The email itself cannot be undone.
 */
export async function inviteStaff(ctx: AdminCtx, input: { name: string; email: string; roles: unknown; reason?: string }): Promise<InviteWrite> {
  await connectDb();
  const name = String(input.name ?? "").trim();
  const email = String(input.email ?? "").trim().toLowerCase();
  if (!name || name.length > NAME_MAX) throw new ValidationError(`Enter a name, up to ${NAME_MAX} characters.`);
  if (email.length > EMAIL_MAX || !EMAIL_SHAPE.test(email)) throw new ValidationError("Enter a full email address, like name@company.com.");
  const roles = cleanRoles(input.roles);
  if (await User.exists({ email })) throw new ConflictError("This email already has an account. Use another email, or change the role of the person on the team.");
  let token = "";
  const written = await adminWrite(ctx, {
    perm: "team.edit",
    action: "team.invite",
    target: { type: "user", id: email, label: name },
    reason: input.reason,
    reasonRequired: roles.includes("superadmin"),
    texts: [name, input.reason],
    undo: { lock: "message_sent" },
    before: async () => null,
    apply: async () => {
      const unusable = await bcrypt.hash(randomToken(), BCRYPT_ROUNDS);
      // Staff fields the sign-up asked for (birth date, adult check) are theirs to give; they are not made up here.
      const doc = new User({ email, displayName: name, roles, passwordHash: unusable, emailVerifiedAt: new Date(), status: "active" });
      await doc.save({ validateBeforeSave: false });
      token = await newInviteToken(doc._id);
      return { after: { email, roles }, result: String(doc._id), summary: `Invited ${name} as ${wordsOf(roles)}` };
    },
  });
  const emailed = await sendInviteMail(email, name, token);
  return { eventId: written.eventId, undoUntil: null, summary: emailed ? `Invite sent to ${email}` : `Saved, but the email to ${email} did not go. Send the invite again.`, userId: written.result, emailed };
}

/** A new link for someone who has not signed in yet (or lost the email). The older links stop working. */
export async function resendInvite(ctx: AdminCtx, input: { userId: string }): Promise<TeamWrite & { emailed: boolean }> {
  await connectDb();
  const user = await loadStaff(String(input.userId));
  const id = String(user._id);
  if (user.status !== "active") throw new ConflictError("This account is not active.");
  let token = "";
  const written = await adminWrite(ctx, {
    perm: "team.edit",
    action: "team.invite.resend",
    target: { type: "user", id, label: user.displayName },
    undo: { lock: "message_sent" },
    before: async () => null,
    apply: async () => {
      await PasswordResetToken.updateMany({ userId: user._id, usedAt: null }, { $set: { usedAt: new Date() } });
      token = await newInviteToken(user._id);
      return { after: { email: user.email }, result: null, summary: `Sent a new invite link to ${user.displayName}` };
    },
  });
  const emailed = await sendInviteMail(user.email, user.displayName, token);
  return { eventId: written.eventId, undoUntil: null, emailed, summary: emailed ? `New link sent to ${user.email}` : `Saved, but the email to ${user.email} did not go.` };
}
