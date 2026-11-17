import mongoose, { type Types } from "mongoose";
import { connectDb } from "@/lib/db";
import type { AdminCtx } from "@/server/admin/context";
import { CLOSE_WORD } from "@/server/admin/close-word";
import { refreshAdPages, revokeSessions } from "@/server/admin/user-actions";
import { adminWrite } from "@/server/admin/write";
import { normalizePhone, PhoneIdentity } from "@/server/auth/phone";
import { normalizeWhatsapp } from "@/server/auth/seller-profile";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/http";
import { Listing, SiteMedia, User } from "@/server/models";
import { STAFF_ROLE_NAMES } from "@/server/models/identity";

/**
 * H7.156: staff edit a user from the Users drawer. Every write goes through adminWrite (permission, reason, blocked words, audit) and can
 * be undone for a while from the saved recipe only (undo kind user.edit). Nothing here deletes an account, a vendor profile or a document:
 * closing is a soft delete, hiding is a flag, removing the badge sets the ID check back to "not done". No ID document data is read.
 */

const NAME_MIN = 2;
const NAME_MAX = 60;
const ABOUT_MAX = 500;

export type EditResult = { eventId: string; undoUntil: string | null; summary: string };

async function loadUser(userId: string) {
  await connectDb();
  if (!mongoose.isValidObjectId(userId)) throw new NotFoundError("Not found");
  const user = await User.findById(userId).lean();
  if (!user) throw new NotFoundError("Not found");
  return user;
}

function refuseStaff(user: { roles?: string[] }) {
  if ((user.roles ?? []).some((role) => STAFF_ROLE_NAMES.has(role))) throw new ForbiddenError("Staff accounts are changed in Team and roles, not here");
}

function cleanName(value: unknown): string {
  const name = String(value ?? "").replace(/\s+/g, " ").trim();
  if (name.length < NAME_MIN || name.length > NAME_MAX) throw new ValidationError(`Enter a name of ${NAME_MIN} to ${NAME_MAX} characters.`);
  return name;
}

function describe(changes: string[]) {
  return changes.length === 1 ? changes[0] : `${changes.slice(0, -1).join(", ")} and ${changes[changes.length - 1]}`;
}

/** Changes the name, the city (sellers) and the sign-in phone number. The email never changes here: it needs the user. */
export async function editProfile(ctx: AdminCtx, input: { userId: string; name: string; city?: string; phone?: string; reason?: string }): Promise<EditResult> {
  await connectDb();
  const user = await loadUser(input.userId);
  refuseStaff(user);
  if (user.status === "deleted") throw new ConflictError("This account was closed.");
  const id = String(user._id);
  const name = cleanName(input.name);
  const seller = Boolean(user.sellerProfile);
  const city = String(input.city ?? "").replace(/\s+/g, " ").trim();
  if (!seller && city) throw new ValidationError("Only sellers have a city.");
  if (seller && (city.length < NAME_MIN || city.length > NAME_MAX)) throw new ValidationError(`Enter a city of ${NAME_MIN} to ${NAME_MAX} characters.`);
  const typedPhone = String(input.phone ?? "").trim();
  let phone: string | null = null;
  if (typedPhone) {
    phone = normalizePhone(typedPhone);
    if (!phone) throw new ValidationError("Enter a 10-digit mobile number, or a number with its country code.");
  }
  const current = await PhoneIdentity.findOne({ userId: user._id }).select("phone").lean<{ phone: string } | null>();
  if (phone && phone !== current?.phone && (await PhoneIdentity.exists({ phone, userId: { $ne: user._id } }))) throw new ConflictError("This number is already on another account.");

  const changes: string[] = [];
  const set: Record<string, unknown> = {};
  const expect: Record<string, unknown> = {};
  const apply: Record<string, unknown> = {};
  if (name !== user.displayName) {
    changes.push("name");
    set.displayName = user.displayName;
    expect.displayName = name;
    apply.displayName = name;
    if (seller) {
      set["sellerProfile.name"] = user.sellerProfile?.name ?? user.displayName;
      expect["sellerProfile.name"] = name;
      apply["sellerProfile.name"] = name;
    }
  }
  if (seller && city !== user.sellerProfile?.city) {
    changes.push("city");
    set["sellerProfile.city"] = user.sellerProfile?.city ?? "";
    expect["sellerProfile.city"] = city;
    apply["sellerProfile.city"] = city;
  }
  const phoneChanged = phone !== null && phone !== (current?.phone ?? null);
  if (phoneChanged) changes.push("phone number");
  if (changes.length === 0) throw new ConflictError("Nothing changed.");

  const written = await adminWrite(ctx, {
    perm: "users.edit",
    action: "user.profile",
    target: { type: "user", id, label: user.displayName },
    reason: input.reason,
    texts: [name, city, input.reason],
    undo: { kind: "user.edit", windowKey: "edits" },
    before: async () => ({ name: user.displayName, city: user.sellerProfile?.city ?? null, phoneSet: Boolean(current) }),
    apply: async () => {
      if (Object.keys(apply).length) await User.updateOne({ _id: user._id }, { $set: apply });
      if (phoneChanged) await PhoneIdentity.updateOne({ userId: user._id }, { $set: { phone } }, { upsert: true });
      return {
        after: { name, city: seller ? city : null, phoneChanged },
        result: null,
        summary: `Changed the ${describe(changes)} of ${user.displayName}`,
        undoData: { userId: id, perm: "users.edit", set, unset: [], expect, ...(phoneChanged ? { phone: current?.phone ?? null, expectPhone: phone } : {}) },
      };
    },
  });
  return { eventId: written.eventId, undoUntil: written.undoUntil, summary: `Saved the ${describe(changes)} of ${user.displayName}` };
}

export type VendorInput = { userId: string; about?: string; whatsapp?: string; photoMediaId?: string; hidden?: boolean; reason?: string };

/** Changes the vendor profile of a seller: about text, WhatsApp number, profile picture (from the media library) and the hidden flag. */
export async function editVendor(ctx: AdminCtx, input: VendorInput): Promise<EditResult> {
  await connectDb();
  const user = await loadUser(input.userId);
  refuseStaff(user);
  if (user.status === "deleted") throw new ConflictError("This account was closed.");
  const profile = user.sellerProfile;
  if (!profile) throw new ConflictError("This person has no vendor profile.");
  const id = String(user._id);

  const about = String(input.about ?? "").replace(/\r\n/g, "\n").trim();
  if (about.length > ABOUT_MAX) throw new ValidationError(`Keep the about text under ${ABOUT_MAX} characters.`);
  const typedWhatsapp = String(input.whatsapp ?? "").trim();
  const whatsapp = normalizeWhatsapp(typedWhatsapp);
  if (typedWhatsapp && whatsapp === null) throw new ValidationError("Enter a WhatsApp number with 8 to 15 digits, or leave it empty.");
  const photo = String(input.photoMediaId ?? "").trim();
  if (photo) {
    const row = mongoose.isValidObjectId(photo) ? await SiteMedia.findById(photo).select("trashedAt").lean<{ trashedAt?: Date | null } | null>() : null;
    if (!row || row.trashedAt) throw new ValidationError("Pick the picture from the media library.");
  }
  const hidden = input.hidden === true;

  const changes: string[] = [];
  const set: Record<string, unknown> = {};
  const unset: string[] = [];
  const expect: Record<string, unknown> = {};
  const apply: Record<string, unknown> = {};
  const drop: string[] = [];
  const track = (path: string, label: string, before: unknown, after: unknown) => {
    if ((before ?? null) === (after ?? null)) return;
    changes.push(label);
    expect[`sellerProfile.${path}`] = after ?? null;
    if (before === undefined || before === null) unset.push(`sellerProfile.${path}`);
    else set[`sellerProfile.${path}`] = before;
    if (after === null || after === undefined) drop.push(`sellerProfile.${path}`);
    else apply[`sellerProfile.${path}`] = after;
  };
  track("about", "about text", profile.about ?? null, about || null);
  track("whatsapp", "WhatsApp number", profile.whatsapp ?? null, whatsapp || null);
  track("photoMediaId", "profile picture", profile.photoMediaId ? String(profile.photoMediaId) : null, photo || null);
  track("hidden", hidden ? "hidden flag (hidden)" : "hidden flag (shown again)", profile.hidden === true ? true : null, hidden ? true : null);
  if (changes.length === 0) throw new ConflictError("Nothing changed.");
  const hiding = hidden && profile.hidden !== true;
  const photoValue = photo ? new mongoose.Types.ObjectId(photo) : null;
  if (photoValue) apply["sellerProfile.photoMediaId"] = photoValue;

  const written = await adminWrite(ctx, {
    perm: "users.edit",
    action: "user.vendor",
    target: { type: "user", id, label: user.displayName },
    reason: input.reason,
    reasonRequired: hiding,
    texts: [about, input.reason],
    undo: { kind: "user.edit", windowKey: "edits" },
    before: async () => ({ about: profile.about ?? null, hidden: profile.hidden === true }),
    apply: async () => {
      const update: Record<string, unknown> = {};
      if (Object.keys(apply).length) update.$set = apply;
      if (drop.length) update.$unset = Object.fromEntries(drop.map((path) => [path, ""]));
      await User.updateOne({ _id: user._id }, update);
      return {
        after: { changed: changes },
        result: null,
        summary: `Changed the vendor profile of ${user.displayName}: ${describe(changes)}`,
        undoData: { userId: id, perm: "users.edit", set, unset, expect },
      };
    },
  });
  return { eventId: written.eventId, undoUntil: written.undoUntil, summary: `Saved the vendor profile of ${user.displayName}` };
}

/** Takes the ID verified badge away: the ID check goes back to "not done" and the person has to do it again. The ID documents are not touched. */
export async function removeVerifiedBadge(ctx: AdminCtx, input: { userId: string; reason: string }): Promise<EditResult> {
  await connectDb();
  const user = await loadUser(input.userId);
  refuseStaff(user);
  if (user.verificationStatus !== "approved") throw new ConflictError("This person does not have the verified badge.");
  const id = String(user._id);
  const written = await adminWrite(ctx, {
    perm: "id.decide",
    action: "user.badge_remove",
    target: { type: "user", id, label: user.displayName },
    reason: input.reason,
    reasonRequired: true,
    texts: [input.reason],
    undo: { kind: "user.edit", windowKey: "decisions" },
    before: async () => ({ verificationStatus: "approved" }),
    apply: async () => {
      await User.updateOne({ _id: user._id }, { $set: { verificationStatus: "unsubmitted" } });
      return {
        after: { verificationStatus: "unsubmitted" },
        result: null,
        summary: `Removed the verified badge of ${user.displayName}`,
        undoData: { userId: id, perm: "id.decide", set: { verificationStatus: "approved" }, unset: [], expect: { verificationStatus: "unsubmitted" } },
      };
    },
  });
  return { eventId: written.eventId, undoUntil: written.undoUntil, summary: `The verified badge of ${user.displayName} is gone` };
}

/**
 * Closes an account the soft way: status "deleted", live ads paused (hidden), every sign-in ended. Nothing is removed from the database.
 * The person types CLOSE to confirm. Undo brings the account and the ads this close paused back; ended sign-ins stay ended.
 */
export async function closeAccount(ctx: AdminCtx, input: { userId: string; reason: string; confirm: string }): Promise<EditResult> {
  await connectDb();
  const user = await loadUser(input.userId);
  refuseStaff(user);
  const id = String(user._id);
  if (id === ctx.actorId) throw new ForbiddenError("You cannot close your own account");
  if (user.status === "deleted") throw new ConflictError("This account is already closed.");
  if (String(input.confirm ?? "").trim() !== CLOSE_WORD) throw new ValidationError(`Type ${CLOSE_WORD} to confirm.`);
  const written = await adminWrite(ctx, {
    perm: "users.ban",
    action: "user.close",
    target: { type: "user", id, label: user.displayName },
    reason: input.reason,
    reasonRequired: true,
    texts: [input.reason],
    undo: { kind: "user.edit", windowKey: "decisions" },
    before: async () => ({ status: user.status }),
    apply: async () => {
      const live = await Listing.find({ ownerId: user._id, status: "active" }).select("_id").lean<{ _id: Types.ObjectId }[]>();
      const ids = live.map((row) => String(row._id));
      if (ids.length) await Listing.updateMany({ _id: { $in: ids }, status: "active" }, { $set: { status: "paused" } });
      await User.updateOne({ _id: user._id }, { $set: { status: "deleted" } });
      const ended = await revokeSessions(user._id);
      return {
        after: { status: "deleted", pausedListings: ids.length, sessionsEnded: ended },
        result: ids,
        summary: `Closed the account of ${user.displayName}: ${ids.length} ${ids.length === 1 ? "ad" : "ads"} hidden, ${ended} ${ended === 1 ? "sign-in" : "sign-ins"} ended`,
        undoData: { userId: id, perm: "users.ban", set: { status: user.status }, unset: [], expect: { status: "deleted" }, ads: { ids, from: "paused", to: "active" } },
      };
    },
  });
  await refreshAdPages(written.result);
  return { eventId: written.eventId, undoUntil: written.undoUntil, summary: `Closed the account of ${user.displayName}` };
}
