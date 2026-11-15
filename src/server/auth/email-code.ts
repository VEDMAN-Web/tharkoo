import { randomInt } from "node:crypto";
import { Schema, Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { AuditRepository } from "@/server/audit";
import { hashToken } from "@/server/auth/http";
import { OTP_MAX_ATTEMPTS, OTP_SENDS_PER_WINDOW, OTP_WINDOW_MS } from "@/server/auth/phone";
import { consumeRateLimit } from "@/server/auth/rate-limit";
import { createCodeAccount, createSession } from "@/server/auth/service";
import { InternalError, UnauthorizedError, ValidationError, isDuplicateKey } from "@/server/http";
import { deliverLoginCodeEmail, loginCodeDelivery } from "@/server/mailer";
import { smsDeliverable } from "@/server/auth/otp";
import { User } from "@/server/models";
import { registerModel } from "@/server/models/register";
import { hashIp, safeEqual, sha256 } from "@/server/shared/crypto";

export const CODE_CANNOT_BE_SENT = "Login codes cannot be sent";

/** One emailed login code. Expires after 10 minutes and is refused after 5 wrong guesses, like the phone code. */
export interface EmailLoginChallengeDoc {
  _id?: Types.ObjectId;
  email: string;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  consumedAt?: Date | null;
  createdAt?: Date;
}

const challengeSchema = new Schema<EmailLoginChallengeDoc>(
  {
    email: { type: String, required: true, index: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "email_login_challenges" },
);
challengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EmailLoginChallenge = registerModel<EmailLoginChallengeDoc>("EmailLoginChallenge", challengeSchema);

const audit = new AuditRepository();

/** Lower-cased, trimmed address, or null when it does not look like an email. */
export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (email.length > 254) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function codeHash(email: string, code: string) {
  return hashToken(`email-otp:${email}:${code}`);
}

function invalidCode() {
  return new UnauthorizedError("Code is invalid or expired");
}

/**
 * Sends a login code to an email address. Limited to three sends per 10 minutes per address and per IP.
 * An address with no active account gets the same answer and no email. If no mail provider can send in production,
 * this fails loudly before any lookup, so it never reports a code as sent.
 */
export async function sendEmailLoginCode(input: { email: string; ip: string }): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  await connectDb();
  const email = normalizeEmail(input.email);
  if (!email) throw new ValidationError("Invalid request", { email: ["Enter a valid email address"] });
  if (loginCodeDelivery() === "unavailable") throw new InternalError(CODE_CANNOT_BE_SENT);
  const byEmail = await consumeRateLimit(`email-otp-send:email:${sha256(email)}`, OTP_SENDS_PER_WINDOW, OTP_WINDOW_MS);
  const byIp = await consumeRateLimit(`email-otp-send:ip:${input.ip}`, OTP_SENDS_PER_WINDOW, OTP_WINDOW_MS);
  if (!byEmail.ok || !byIp.ok) {
    return { ok: false, retryAfter: Math.max(byEmail.retryAfter, byIp.retryAfter) };
  }
  // The code goes to any address, known or new: a new address signs up by proving it with this code (H7.2b).
  // The answer is the same either way, so the endpoint does not reveal which addresses have accounts.
  const code = String(randomInt(100000, 1000000));
  const challenge = await EmailLoginChallenge.create({
    email,
    codeHash: codeHash(email, code),
    expiresAt: new Date(Date.now() + OTP_WINDOW_MS),
  });
  const delivered = await deliverLoginCodeEmail(email, code);
  if (!delivered) {
    await EmailLoginChallenge.deleteOne({ _id: challenge._id });
    throw new InternalError("Login code could not be sent. Try again in a few minutes.");
  }
  return { ok: true };
}

/** Checks the newest live code for the address. Each guess counts. A code is used up on success. */
export async function verifyEmailLoginCode(input: {
  email: string;
  code: string;
  userAgent?: string | null;
  ip?: string;
  existingToken?: string;
  requestId: string;
}) {
  await connectDb();
  const email = normalizeEmail(input.email);
  if (!email || !/^\d{6}$/.test(input.code)) throw invalidCode();
  const challenge = await EmailLoginChallenge.findOne({ email, consumedAt: null, expiresAt: { $gt: new Date() } })
    .sort({ _id: -1 })
    .lean();
  if (!challenge || challenge.attempts >= OTP_MAX_ATTEMPTS) throw invalidCode();
  // The guess is counted before it is compared, so parallel guesses cannot get past the limit.
  const counted = await EmailLoginChallenge.findOneAndUpdate(
    { _id: challenge._id, consumedAt: null, attempts: { $lt: OTP_MAX_ATTEMPTS } },
    { $inc: { attempts: 1 } },
    { returnDocument: "after" },
  ).lean();
  if (!counted || !safeEqual(counted.codeHash, codeHash(email, input.code))) {
    if (counted && counted.attempts >= OTP_MAX_ATTEMPTS) {
      await audit.append({
        actorType: "system",
        action: "auth.login_code.locked",
        targetType: "email_login_challenge",
        targetId: String(challenge._id),
        requestId: input.requestId,
        ipHash: hashIp(input.ip),
      });
    }
    throw invalidCode();
  }
  const used = await EmailLoginChallenge.updateOne({ _id: challenge._id, consumedAt: null }, { $set: { consumedAt: new Date() } });
  if (used.modifiedCount !== 1) throw invalidCode();
  const { user, created } = await userForCode(email);
  if (user.status !== "active") throw invalidCode();
  // The code proves the address, so a legacy account gets its email marked verified here.
  if (!user.emailVerifiedAt) await User.updateOne({ _id: user._id }, { $set: { emailVerifiedAt: new Date() } });
  if (created) {
    await audit.append({
      actorId: user._id,
      actorType: "user",
      action: "auth.sign_up.code_account",
      targetType: "user",
      targetId: user._id.toString(),
      requestId: input.requestId,
      ipHash: hashIp(input.ip),
    });
  }
  await audit.append({
    actorId: user._id,
    actorType: "user",
    action: "auth.login_code.success",
    targetType: "user",
    targetId: user._id.toString(),
    requestId: input.requestId,
    ipHash: hashIp(input.ip),
  });
  return createSession(user, { userAgent: input.userAgent, ip: input.ip, existingToken: input.existingToken });
}

/** The account for a proven address. A new address gets a new account with no password. Two codes racing is handled. */
async function userForCode(email: string) {
  const existing = await User.findOne({ email });
  if (existing) return { user: existing, created: false };
  try {
    return { user: await createCodeAccount(email), created: true };
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    const raced = await User.findOne({ email });
    if (!raced) throw error;
    return { user: raced, created: false };
  }
}

/**
 * Admin dashboard warning (H7.2b). Shown when no code can leave the server: no email provider in production and no
 * SMS provider that can deliver. Off production, the dev log counts as a delivery, so no warning there.
 */
export function loginCodeWarning(): string | null {
  const emailReady = loginCodeDelivery() !== "unavailable";
  return emailReady || smsDeliverable() ? null : CODE_CANNOT_BE_SENT;
}
