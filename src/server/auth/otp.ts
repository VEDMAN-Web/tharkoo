import { randomInt } from "node:crypto";
import { connectDb } from "@/lib/db";
import { hashToken } from "@/server/auth/http";
import { PhoneIdentity, PhoneLoginChallenge, OTP_MAX_ATTEMPTS, OTP_SENDS_PER_WINDOW, OTP_WINDOW_MS, normalizePhone } from "@/server/auth/phone";
import { consumeRateLimit } from "@/server/auth/rate-limit";
import { createSession } from "@/server/auth/service";
import { InternalError, UnauthorizedError, ValidationError } from "@/server/http";
import { User } from "@/server/models";
import { safeEqual, sha256 } from "@/server/shared/crypto";

/** Sends a one-time code by SMS. Implementations never see or store the code after sending it. */
export interface OtpProvider {
  readonly name: "mock" | "sms";
  send(input: { phone: string; code: string }): Promise<void>;
}

/** Development only. The code is logged, never sent, and the mock refuses to run in production. */
const mockOtp: OtpProvider = {
  name: "mock",
  send: async ({ phone, code }) => {
    if (process.env.NODE_ENV === "production") {
      throw new InternalError("SMS_PROVIDER is not configured: login codes cannot be sent");
    }
    console.info(`[otp-mock] to=***${phone.slice(-2)} code=${code}`);
  },
};

/** TODO: SMS gateway using SMS_PROVIDER and SMS_API_KEY. Not built: no key exists yet. */
const smsOtp: OtpProvider = {
  name: "sms",
  send: async () => {
    throw new InternalError("SMS is not configured (needs SMS_PROVIDER and SMS_API_KEY)");
  },
};

let override: OtpProvider | null = null;

/** Tests swap in a recording provider here. Pass null to restore the environment choice. */
export function setOtpProvider(provider: OtpProvider | null) {
  override = provider;
}

export function otpProvider(): OtpProvider {
  if (override) return override;
  const name = process.env.SMS_PROVIDER?.trim();
  return !name || name === "mock" ? mockOtp : smsOtp;
}

function invalidCode() {
  return new UnauthorizedError("Code is invalid or expired");
}

function codeHash(phone: string, code: string) {
  return hashToken(`otp:${phone}:${code}`);
}

/**
 * Sends a login code. Limited to three sends per 10 minutes per phone number and per IP. A number that is not linked
 * to an account gets the same answer but no SMS, so the endpoint does not reveal which numbers have accounts.
 */
export async function sendLoginCode(input: { phone: string; ip: string }): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  await connectDb();
  const phone = normalizePhone(input.phone);
  if (!phone) throw new ValidationError("Invalid request", { phone: ["Enter a valid phone number"] });
  const byPhone = await consumeRateLimit(`otp-send:phone:${sha256(phone)}`, OTP_SENDS_PER_WINDOW, OTP_WINDOW_MS);
  const byIp = await consumeRateLimit(`otp-send:ip:${input.ip}`, OTP_SENDS_PER_WINDOW, OTP_WINDOW_MS);
  if (!byPhone.ok || !byIp.ok) {
    return { ok: false, retryAfter: Math.max(byPhone.retryAfter, byIp.retryAfter) };
  }
  const identity = await PhoneIdentity.findOne({ phone }).lean();
  if (identity) {
    const code = String(randomInt(100000, 1000000));
    await PhoneLoginChallenge.create({
      phone,
      codeHash: codeHash(phone, code),
      expiresAt: new Date(Date.now() + OTP_WINDOW_MS),
    });
    await otpProvider().send({ phone, code });
  }
  return { ok: true };
}

/** Checks the newest live code for the number. Each guess counts, and a code is used up on success. */
export async function verifyLoginCode(input: {
  phone: string;
  code: string;
  userAgent?: string | null;
  ip?: string;
  existingToken?: string;
}) {
  await connectDb();
  const phone = normalizePhone(input.phone);
  if (!phone || !/^\d{6}$/.test(input.code)) throw invalidCode();
  const challenge = await PhoneLoginChallenge.findOne({ phone, consumedAt: null, expiresAt: { $gt: new Date() } }).sort({ _id: -1 }).lean();
  if (!challenge || challenge.attempts >= OTP_MAX_ATTEMPTS) throw invalidCode();
  // The guess is counted before it is compared, so parallel guesses cannot get past the limit.
  const counted = await PhoneLoginChallenge.findOneAndUpdate(
    { _id: challenge._id, consumedAt: null, attempts: { $lt: OTP_MAX_ATTEMPTS } },
    { $inc: { attempts: 1 } },
    { returnDocument: "after" },
  ).lean();
  if (!counted || !safeEqual(counted.codeHash, codeHash(phone, input.code))) throw invalidCode();
  const used = await PhoneLoginChallenge.updateOne({ _id: challenge._id, consumedAt: null }, { $set: { consumedAt: new Date() } });
  if (used.modifiedCount !== 1) throw invalidCode();
  const identity = await PhoneIdentity.findOne({ phone }).lean();
  const user = identity ? await User.findById(identity.userId) : null;
  if (!user || user.status !== "active") throw invalidCode();
  return createSession(user, { userAgent: input.userAgent, ip: input.ip, existingToken: input.existingToken });
}
