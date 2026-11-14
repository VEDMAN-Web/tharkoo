import { Schema, Types } from "mongoose";
import { registerModel } from "@/server/models/register";

/**
 * A phone number linked to one account. Linked by a signed-in user who proved the number with a code (confirmPhone),
 * so only linked numbers can log in with a code.
 */
export interface PhoneIdentityDoc {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  phone: string;
  createdAt?: Date;
}

const identitySchema = new Schema<PhoneIdentityDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, unique: true },
    phone: { type: String, required: true, unique: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "phone_identities" },
);

export const PhoneIdentity = registerModel<PhoneIdentityDoc>("PhoneIdentity", identitySchema);

/** One login code. Expires after 10 minutes and is refused after 5 wrong guesses. */
export interface PhoneLoginChallengeDoc {
  _id?: Types.ObjectId;
  phone: string;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  consumedAt?: Date | null;
  createdAt?: Date;
}

const challengeSchema = new Schema<PhoneLoginChallengeDoc>(
  {
    phone: { type: String, required: true, index: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "phone_login_challenges" },
);
challengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PhoneLoginChallenge = registerModel<PhoneLoginChallengeDoc>("PhoneLoginChallenge", challengeSchema);

export const OTP_WINDOW_MS = 1000 * 60 * 10;
export const OTP_SENDS_PER_WINDOW = 3;
export const OTP_MAX_ATTEMPTS = 5;

/** Accepts "98765 43210", "+91-98765-43210" or "+919876543210". A bare 10-digit number is read as Indian (+91). */
export function normalizePhone(raw: string): string | null {
  const compact = raw.replace(/[\s()-]/g, "");
  if (/^\d{10}$/.test(compact)) return `+91${compact}`;
  if (/^\+\d{10,15}$/.test(compact)) return compact;
  return null;
}
