import mongoose from "mongoose";
import { hashToken } from "@/server/auth/http";
import { postTransaction } from "@/server/ledger";
import { Session, User } from "@/server/models";
import { GET as walletGet, POST as walletPost, PUT as walletPut } from "@/app/api/wallet/[[...slug]]/route";
import { payoutKycSchema, submitPayoutKyc } from "@/server/wallet/payout-kyc";

export const origin = "http://127.0.0.1:4317";
export const req = "req-payout-tests";
export const ip = "203.0.113.7";

export const bankDetails = {
  method: "bank" as const,
  legalName: "Ada Lovelace",
  pan: "abcde1234f",
  accountNumber: "123456789012",
  ifsc: "hdfc0001234",
};

/** Creates a signed-in person with the given roles. The cookie is a real session row. */
export async function person(email: string, roles = ["user"]) {
  const user = await User.create({
    email,
    passwordHash: "hash",
    displayName: "Vendor",
    dateOfBirth: new Date("1990-01-01"),
    attestedAdultAt: new Date(),
    emailVerifiedAt: new Date(),
    roles,
    verificationStatus: "approved",
    status: "active",
  });
  const token = `tok-${email}`;
  await Session.create({ userId: user._id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 86_400_000) });
  return { id: String(user._id), cookie: `sid=${encodeURIComponent(token)}` };
}

/** Puts coins into a vendor's earnings the way a completed booking does, through the ledger. */
export async function earn(vendorId: string, coins: number) {
  await postTransaction({
    idempotencyKey: `test-earn:${new mongoose.Types.ObjectId().toString()}`,
    kind: "escrow_release",
    refType: "booking",
    refId: new mongoose.Types.ObjectId().toString(),
    moves: [
      { account: "external", ownerKey: "system", delta: -coins },
      { account: "vendor_earnings", ownerKey: vendorId, delta: coins },
    ],
    requestId: req,
    actorType: "system",
  });
}

export async function withKyc(vendorId: string) {
  return submitPayoutKyc({ userId: vendorId, values: payoutKycSchema.parse(bankDetails), requestId: req, ip });
}

/** Calls the wallet dispatcher the way Next does, with the same-origin header the route requires. */
export function call(method: "GET" | "POST" | "PUT", path: string, cookie: string, body?: unknown) {
  const headers = new Headers({ origin, cookie });
  if (body !== undefined) headers.set("content-type", "application/json");
  const request = new Request(`${origin}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (method === "GET") return walletGet(request);
  if (method === "PUT") return walletPut(request);
  return walletPost(request);
}
