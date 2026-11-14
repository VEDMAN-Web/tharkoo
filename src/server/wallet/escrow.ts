import { postTransaction } from "@/server/ledger/service";
import { assertVideoTourAllowed } from "@/server/wallet/listing-guard";
import { assertSpendAllowed } from "@/server/wallet/guards";

interface EscrowRef {
  userId: string;
  vendorId: string;
  coins: number;
  /** One id per booking. It makes every step below safe to repeat. */
  bookingId: string;
  requestId: string;
  ip?: string;
}

/** The escrow account is owned by the booking, so one booking can never draw on another booking's coins. */
const escrowOwner = (bookingId: string) => `booking:${bookingId}`;

/**
 * Holds the user's coins for a booking. Refused unless the listing's category allows live tours (read from the database),
 * if a registered spend guard says no, or if the wallet is short.
 */
export async function holdInEscrow(input: EscrowRef & { listingId: string }) {
  await assertVideoTourAllowed(input.listingId);
  await assertSpendAllowed({
    userId: input.userId,
    vendorId: input.vendorId,
    coins: input.coins,
    purpose: "booking",
    refId: input.bookingId,
  });
  return postTransaction({
    idempotencyKey: `escrow-hold:${input.bookingId}`,
    kind: "escrow_hold",
    refType: "booking",
    refId: input.bookingId,
    moves: [
      { account: "user_wallet", ownerKey: input.userId, delta: -input.coins },
      { account: "escrow", ownerKey: escrowOwner(input.bookingId), delta: input.coins },
    ],
    requestId: input.requestId,
    actorId: input.userId,
    actorType: "user",
    ip: input.ip,
  });
}

/** A declined or cancelled booking: the whole hold goes back to the user's wallet. */
export function refundEscrow(input: EscrowRef) {
  return postTransaction({
    idempotencyKey: `escrow-refund:${input.bookingId}`,
    kind: "escrow_refund",
    refType: "booking",
    refId: input.bookingId,
    moves: [
      { account: "escrow", ownerKey: escrowOwner(input.bookingId), delta: -input.coins },
      { account: "user_wallet", ownerKey: input.userId, delta: input.coins },
    ],
    requestId: input.requestId,
    actorType: "system",
    ip: input.ip,
  });
}

/** A completed booking: the vendor's share moves to vendor_earnings. The platform fee, if any, is platform_revenue. */
export function releaseEscrow(input: EscrowRef & { platformFee?: number }) {
  const fee = input.platformFee ?? 0;
  return postTransaction({
    idempotencyKey: `escrow-release:${input.bookingId}`,
    kind: "escrow_release",
    refType: "booking",
    refId: input.bookingId,
    moves: [
      { account: "escrow", ownerKey: escrowOwner(input.bookingId), delta: -input.coins },
      { account: "vendor_earnings", ownerKey: input.vendorId, delta: input.coins - fee },
      ...(fee > 0 ? [{ account: "platform_revenue" as const, ownerKey: "system", delta: fee }] : []),
    ],
    requestId: input.requestId,
    actorType: "system",
    ip: input.ip,
  });
}
