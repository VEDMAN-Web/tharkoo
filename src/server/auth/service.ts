import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { Schema, Types } from "mongoose";
import { AuditRepository } from "@/server/audit";
import { hashToken, SESSION_MS, siteOrigin } from "@/server/auth/http";
import { connectDb } from "@/lib/db";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  VerificationRequiredError,
  isDuplicateKey,
} from "@/server/http";
import { mailerFromEnv } from "@/server/mailer";
import {
  EmailVerificationToken,
  FeatureFlag,
  PasswordResetToken,
  Session,
  User,
  type UserDoc,
} from "@/server/models";
import { registerModel } from "@/server/models/register";
import { isAtLeast18, parseDateOnly } from "@/server/shared/age";
import { hashIp, randomToken, safeEqual, sha256 } from "@/server/shared/crypto";

const VERIFY_MS = 1000 * 60 * 60 * 24;
const RESET_MS = 1000 * 60 * 60;
const PHONE_MS = 1000 * 60 * 10;

export const STAFF_ROLES = new Set([
  "admin",
  "superadmin",
  "moderator",
  "trust_safety",
  "support",
  "seo_editor",
  "finance",
]);

const ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  user: ["listings.write"],
  admin: ["admin", "listings.write"],
  superadmin: ["admin", "listings.write"],
  moderator: ["admin", "moderation"],
  trust_safety: ["admin", "moderation"],
  support: ["admin", "support"],
  seo_editor: ["admin", "seo"],
  finance: ["admin", "finance"],
};

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  dateOfBirth: string;
  attestedAdultAt: string;
  emailVerifiedAt: string | null;
  roles: string[];
  verificationStatus: UserDoc["verificationStatus"];
  status: UserDoc["status"];
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
  dateOfBirth: string;
  acceptedTerms: true;
  attestedAdult: true;
}

interface PhoneDoc {
  userId: Types.ObjectId;
  phone: string;
  codeHash: string;
  expiresAt: Date;
  confirmedAt?: Date;
}

const phoneSchema = new Schema<PhoneDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    phone: { type: String, required: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    confirmedAt: Date,
  },
  { collection: "phone_otp_challenges", timestamps: { createdAt: true, updatedAt: false } },
);
phoneSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const PhoneChallenge = registerModel<PhoneDoc>("PhoneOtpChallenge", phoneSchema);

export function isStaffRole(roles: string[]) {
  return roles.some((role) => STAFF_ROLES.has(role));
}

export function permissionsFor(roles: string[]) {
  const permissions = new Set<string>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) permissions.add(permission);
  }
  if (permissions.size === 0) permissions.add("listings.write");
  return [...permissions];
}

function rounds() {
  const raw = Number(process.env.BCRYPT_ROUNDS);
  if (Number.isInteger(raw) && raw >= 4) return raw;
  return process.env.NODE_ENV === "production" ? 12 : 4;
}

let dummyHash: Promise<string> | null = null;
function dummyPasswordHash() {
  dummyHash ??= bcrypt.hash("placeholder-password", rounds());
  return dummyHash;
}

function publicUser(user: UserDoc & { _id: Types.ObjectId }): PublicUser {
  return {
    id: user._id.toString(),
    email: user.email,
    displayName: user.displayName,
    dateOfBirth: user.dateOfBirth.toISOString(),
    attestedAdultAt: user.attestedAdultAt.toISOString(),
    emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
    roles: user.roles?.length ? user.roles : ["user"],
    verificationStatus: user.verificationStatus,
    status: user.status,
  };
}

async function ready() {
  await connectDb();
}

/**
 * Staging has no mail provider. Auto-verify is allowed only when the site is
 * also marked noindex, so a production deploy cannot turn the flag on by mistake.
 */
export function stagingAutoVerifyDecision(): "on" | "off" {
  if (process.env.STAGING_AUTO_VERIFY_EMAIL !== "true") return "off";
  if (process.env.SITE_NOINDEX === "true") return "on";
  throw new ForbiddenError("Automatic email verification is only allowed when SITE_NOINDEX=true");
}

export async function registerUser(input: RegisterInput) {
  await ready();
  const dateOfBirth = parseDateOnly(input.dateOfBirth);
  if (!dateOfBirth) throw new ValidationError("Invalid request", { dateOfBirth: ["Invalid date"] });
  if (!isAtLeast18(dateOfBirth)) throw new VerificationRequiredError("You must be 18 or older");
  const email = input.email.toLowerCase();
  const passwordHash = await bcrypt.hash(input.password, rounds());
  const autoVerify = stagingAutoVerifyDecision();
  try {
    const user = await User.create({
      email,
      passwordHash,
      displayName: input.displayName.trim(),
      dateOfBirth,
      attestedAdultAt: new Date(),
      roles: ["user"],
      verificationStatus: "unsubmitted",
      status: "active",
      ...(autoVerify === "on" ? { emailVerifiedAt: new Date() } : {}),
    });
    if (autoVerify === "off") {
      const token = randomToken();
      await EmailVerificationToken.create({
        userId: user._id,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + VERIFY_MS),
      });
      await mailerFromEnv().send({
        to: email,
        subject: "Verify your email",
        text: `Open ${siteOrigin()}/u/verify-email?token=${token} to verify your email.`,
      });
    }
    return { userId: user._id.toString() };
  } catch (error) {
    if (isDuplicateKey(error)) throw new ConflictError("An account with that email already exists");
    throw error;
  }
}

export async function verifyEmail(token: string) {
  await ready();
  const doc = await EmailVerificationToken.findOne({
    tokenHash: sha256(token),
    usedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!doc) throw new NotFoundError("Verification link is invalid or expired");
  doc.usedAt = new Date();
  await doc.save();
  await User.updateOne({ _id: doc.userId }, { $set: { emailVerifiedAt: new Date() } });
  return { verified: true as const };
}

export async function loginUser(input: {
  email: string;
  password: string;
  userAgent?: string | null;
  ip?: string;
  existingToken?: string;
}) {
  await ready();
  await bootstrapAdmin();
  const email = input.email.toLowerCase();
  const user = await User.findOne({ email }).select("+passwordHash");
  const passwordHash = user?.get("passwordHash") ?? (await dummyPasswordHash());
  const matches = await bcrypt.compare(input.password, String(passwordHash));
  if (!user || !matches) throw new UnauthorizedError("Email or password is incorrect");
  if (user.status !== "active") throw new ForbiddenError("Account is not active");
  if (!user.emailVerifiedAt) throw new ForbiddenError("Verify your email before signing in");
  if (input.existingToken) {
    await Session.updateOne(
      { tokenHash: hashToken(input.existingToken), revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }
  const token = randomToken();
  const session = await Session.create({
    userId: user._id,
    tokenHash: hashToken(token),
    userAgent: input.userAgent?.slice(0, 200),
    ipHash: hashIp(input.ip),
    expiresAt: new Date(Date.now() + SESSION_MS),
  });
  return { token, sessionId: session._id.toString(), user: publicUser(user) };
}

export async function logoutSession(token: string | undefined) {
  await ready();
  if (!token) throw new UnauthorizedError("Sign in required");
  const updated = await Session.updateOne(
    { tokenHash: hashToken(token), revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
  if (updated.matchedCount === 0) throw new UnauthorizedError("Sign in required");
  return { ok: true as const };
}

export async function userFromToken(token: string | undefined) {
  if (!token) return null;
  await ready();
  const session = await Session.findOne({
    tokenHash: hashToken(token),
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!session) return null;
  const user = await User.findById(session.userId);
  if (!user || user.status !== "active") return null;
  return { sessionId: session._id.toString(), user: publicUser(user) };
}

export async function requireUser(token: string | undefined) {
  const found = await userFromToken(token);
  if (!found) throw new UnauthorizedError("Sign in required");
  return found;
}

export async function forgotPassword(email: string) {
  await ready();
  const user = await User.findOne({ email: email.toLowerCase(), status: "active" });
  if (user) {
    const token = randomToken();
    await PasswordResetToken.create({
      userId: user._id,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + RESET_MS),
    });
    await mailerFromEnv().send({
      to: user.email,
      subject: "Reset your password",
      text: `Open ${siteOrigin()}/u/reset?token=${token} to choose a new password.`,
    });
  }
  return { ok: true as const };
}

export async function resetPassword(token: string, password: string) {
  await ready();
  const doc = await PasswordResetToken.findOne({
    tokenHash: sha256(token),
    usedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!doc) throw new NotFoundError("Reset link is invalid or expired");
  doc.usedAt = new Date();
  await doc.save();
  await User.updateOne({ _id: doc.userId }, { $set: { passwordHash: await bcrypt.hash(password, rounds()) } });
  await Session.updateMany({ userId: doc.userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
  return { ok: true as const };
}

export async function listSessions(userId: string, currentSessionId: string) {
  await ready();
  const sessions = await Session.find({ userId, revokedAt: null, expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .lean();
  return {
    sessions: sessions.map((session) => ({
      id: String(session._id),
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      userAgent: session.userAgent ?? null,
      current: String(session._id) === currentSessionId,
    })),
  };
}

export async function revokeOwnedSession(userId: string, sessionId: string) {
  await ready();
  if (!Types.ObjectId.isValid(sessionId)) throw new NotFoundError("Session not found");
  const updated = await Session.updateOne(
    { _id: sessionId, userId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
  if (updated.matchedCount === 0) throw new NotFoundError("Session not found");
  return { ok: true as const };
}

async function phoneEnabled() {
  if (process.env.NODE_ENV !== "production") return true;
  const flag = await FeatureFlag.findOne({ key: "phone-otp", enabled: true }).lean();
  return Boolean(flag);
}

export async function startPhone(userId: string, phone: string) {
  await ready();
  if (!(await phoneEnabled())) throw new ForbiddenError("Phone verification is not available");
  const code = String(randomInt(100000, 1000000));
  const doc = await PhoneChallenge.create({
    userId,
    phone,
    codeHash: sha256(code),
    expiresAt: new Date(Date.now() + PHONE_MS),
  });
  const smsReady = Boolean(process.env.SMS_PROVIDER?.trim() && process.env.SMS_API_KEY?.trim());
  if (!smsReady) {
    console.info(`[phone-otp] challenge=${doc._id.toString()} code=${code}`);
  }
  return {
    challengeId: doc._id.toString(),
    ...(process.env.NODE_ENV === "production" ? {} : { dev: true as const }),
  };
}

export async function confirmPhone(userId: string, challengeId: string, code: string) {
  await ready();
  if (!Types.ObjectId.isValid(challengeId)) throw new UnauthorizedError("Code is invalid or expired");
  const doc = await PhoneChallenge.findOne({
    _id: challengeId,
    userId,
    confirmedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!doc || !safeEqual(doc.codeHash, sha256(code))) {
    throw new UnauthorizedError("Code is invalid or expired");
  }
  doc.confirmedAt = new Date();
  await doc.save();
  return { phoneVerified: true as const };
}

/** Creates one superadmin when both env vars are set and that email is absent. */
export async function bootstrapAdmin(): Promise<"created" | "skipped"> {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "";
  if (!email || password.length < 8 || !process.env.MONGODB_URI) return "skipped";
  await ready();
  const existing = await User.findOne({ email });
  if (existing) return "skipped";
  const user = await User.create({
    email,
    passwordHash: await bcrypt.hash(password, rounds()),
    displayName: "Admin",
    dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
    attestedAdultAt: new Date(),
    emailVerifiedAt: new Date(),
    roles: ["superadmin"],
    verificationStatus: "approved",
    status: "active",
  });
  await new AuditRepository().append({
    actorId: null,
    actorType: "system",
    action: "admin.bootstrap",
    targetType: "user",
    targetId: user._id.toString(),
    after: {
      email,
      roles: ["superadmin"],
      verificationStatus: "approved",
      status: "active",
    },
    requestId: "startup",
  });
  return "created";
}
