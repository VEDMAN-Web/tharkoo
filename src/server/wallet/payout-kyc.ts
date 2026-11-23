import { Schema, Types } from "mongoose";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { AuditRepository } from "@/server/audit";
import { ConflictError, InternalError, isDuplicateKey } from "@/server/http";
import { hashIp } from "@/server/shared/crypto";
import { registerModel } from "@/server/models/register";
import { findPayoutOption, PAYOUT_COINS, PAYOUT_NETWORKS, type PayoutCoin, type PayoutNetwork } from "@/server/wallet/payout-coins";
import {
  decryptField,
  encryptField,
  isEncryptionConfigured,
  maskTail,
  maskUpi,
  PAYOUT_DETAILS_UNAVAILABLE,
} from "@/server/wallet/payout-crypto";

const audit = new AuditRepository();

/** Trimmed and upper-cased before the pattern runs, so "abcde1234f" is accepted as a PAN. */
const upper = (pattern: RegExp, message: string) =>
  z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(z.string().regex(pattern, message));

export const payoutKycSchema = z.discriminatedUnion("method", [
  z
    .object({
      method: z.literal("bank"),
      legalName: z.string().trim().min(2).max(120),
      pan: upper(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Enter a valid PAN"),
      accountNumber: z.string().trim().regex(/^\d{6,18}$/, "Enter a valid bank account number"),
      ifsc: upper(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Enter a valid IFSC code"),
    })
    .strict(),
  z
    .object({
      method: z.literal("upi"),
      legalName: z.string().trim().min(2).max(120),
      pan: upper(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Enter a valid PAN"),
      upiId: z
        .string()
        .trim()
        .regex(/^[a-zA-Z0-9._-]{2,64}@[a-zA-Z]{2,32}$/, "Enter a valid UPI ID"),
    })
    .strict(),
  // H18.6: crypto payout through PassimPay. H19.9: USDT, USDC, BTC, ETH, TRX or LTC; the address is checked for the chosen coin and network.
  z
    .object({
      method: z.literal("crypto"),
      legalName: z.string().trim().min(2).max(120),
      pan: upper(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Enter a valid PAN"),
      coin: z.enum(PAYOUT_COINS).default("USDT"),
      network: z.enum(PAYOUT_NETWORKS),
      walletAddress: z.string().trim().min(26).max(100),
    })
    .strict()
    .superRefine((value, ctx) => {
      const option = findPayoutOption(value.coin, value.network);
      if (!option) return ctx.addIssue({ code: "custom", path: ["network"], message: `${value.coin} is not available on ${value.network}` });
      if (!option.address.test(value.walletAddress)) ctx.addIssue({ code: "custom", path: ["walletAddress"], message: `Enter a valid ${option.label} address (${option.addressHint})` });
    }),
]);
/** H18.6: crypto (USDT via PassimPay) is the method that pays out today; bank and UPI need a payout account. */
export type PayoutMethod = "bank" | "upi" | "crypto";
export type PayoutKycInput = z.infer<typeof payoutKycSchema>;

/** Only encrypted values are stored. Display values are computed from them on read. */
export interface PayoutKycDoc {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  method: PayoutMethod;
  legalNameEnc: string;
  panEnc: string;
  accountEnc?: string;
  ifscEnc?: string;
  upiEnc?: string;
  cryptoNetwork?: PayoutNetwork;
  /** H19.9: missing on wallets saved before, which were all USDT. */
  cryptoCoin?: PayoutCoin;
  walletEnc?: string;
  createdAt?: Date;
}

const kycSchema = new Schema<PayoutKycDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, unique: true },
    method: { type: String, enum: ["bank", "upi", "crypto"], required: true },
    legalNameEnc: { type: String, required: true },
    panEnc: { type: String, required: true },
    accountEnc: String,
    ifscEnc: String,
    upiEnc: String,
    cryptoNetwork: { type: String, enum: PAYOUT_NETWORKS },
    cryptoCoin: { type: String, enum: PAYOUT_COINS },
    walletEnc: String,
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "payout_kyc" },
);

export const PayoutKyc = registerModel<PayoutKycDoc>("PayoutKyc", kycSchema);

/** What the vendor and admins may see. Sensitive values are masked; the name is shown to its owner only. */
export interface MaskedPayoutKyc {
  method: PayoutMethod;
  legalName: string;
  pan: string;
  accountNumber?: string;
  ifsc?: string;
  upiId?: string;
  coin?: PayoutCoin;
  network?: PayoutNetwork;
  walletAddress?: string;
  submittedAt: string | null;
}

export function maskedKyc(row: PayoutKycDoc): MaskedPayoutKyc {
  const pan = decryptField(row.panEnc);
  const base = {
    method: row.method,
    legalName: decryptField(row.legalNameEnc),
    pan: maskTail(pan),
    submittedAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  };
  if (row.method === "crypto") {
    const wallet = row.walletEnc ? decryptField(row.walletEnc) : "";
    return { ...base, coin: row.cryptoCoin ?? "USDT", network: row.cryptoNetwork, walletAddress: wallet ? `${wallet.slice(0, 4)}…${wallet.slice(-4)}` : undefined };
  }
  if (row.method === "upi") {
    return { ...base, upiId: row.upiEnc ? maskUpi(decryptField(row.upiEnc)) : undefined };
  }
  return {
    ...base,
    accountNumber: row.accountEnc ? maskTail(decryptField(row.accountEnc)) : undefined,
    ifsc: row.ifscEnc ? decryptField(row.ifscEnc) : undefined,
  };
}

/** Full values for one payout record. Only the reveal service calls this, after the role, rate and audit steps. */
export interface RevealedPayoutKyc {
  method: PayoutMethod;
  legalName: string;
  pan: string;
  accountNumber?: string;
  ifsc?: string;
  upiId?: string;
  coin?: PayoutCoin;
  network?: PayoutNetwork;
  walletAddress?: string;
}

export function revealedKyc(row: PayoutKycDoc): RevealedPayoutKyc {
  const base = { method: row.method, legalName: decryptField(row.legalNameEnc), pan: decryptField(row.panEnc) };
  if (row.method === "crypto") {
    return { ...base, coin: row.cryptoCoin ?? "USDT", network: row.cryptoNetwork, walletAddress: row.walletEnc ? decryptField(row.walletEnc) : undefined };
  }
  if (row.method === "upi") {
    return { ...base, upiId: row.upiEnc ? decryptField(row.upiEnc) : undefined };
  }
  return {
    ...base,
    accountNumber: row.accountEnc ? decryptField(row.accountEnc) : undefined,
    ifsc: row.ifscEnc ? decryptField(row.ifscEnc) : undefined,
  };
}

export async function getPayoutKyc(userId: string): Promise<MaskedPayoutKyc | null> {
  await connectDb();
  await PayoutKyc.init();
  const row = await PayoutKyc.findOne({ userId: new Types.ObjectId(userId) }).lean();
  return row ? maskedKyc(row) : null;
}

/**
 * Payout details are completed once. Changing a bank account after a withdrawal would let a stolen session
 * redirect money, so a second submit is refused; a correction goes through support.
 */
export async function submitPayoutKyc(input: { userId: string; values: PayoutKycInput; requestId: string; ip?: string }) {
  // Fail closed: without the key nothing is encrypted, so nothing is stored at all.
  if (!isEncryptionConfigured()) {
    console.error("payout.kyc.unavailable: CONTACT_ENCRYPTION_KEY is not set");
    throw new InternalError(PAYOUT_DETAILS_UNAVAILABLE);
  }
  await connectDb();
  await PayoutKyc.init();
  const userId = new Types.ObjectId(input.userId);
  const values = input.values;
  const existing = await PayoutKyc.exists({ userId });
  if (existing) throw new ConflictError("Payout details are already on file");
  let row;
  try {
    row = await PayoutKyc.create({
      userId,
      method: values.method,
      legalNameEnc: encryptField(values.legalName),
      panEnc: encryptField(values.pan),
      ...(values.method === "bank"
        ? { accountEnc: encryptField(values.accountNumber), ifscEnc: encryptField(values.ifsc) }
        : values.method === "upi"
          ? { upiEnc: encryptField(values.upiId) }
          : { cryptoCoin: values.coin, cryptoNetwork: values.network, walletEnc: encryptField(values.walletAddress) }),
    });
  } catch (error) {
    if (isDuplicateKey(error)) throw new ConflictError("Payout details are already on file");
    throw error;
  }
  await audit.append({
    actorId: input.userId,
    actorType: "user",
    action: "payout.kyc.submit",
    targetType: "payout_kyc",
    targetId: String(row._id),
    requestId: input.requestId,
    after: { method: values.method },
    ipHash: hashIp(input.ip),
  });
  return maskedKyc(row.toObject());
}
