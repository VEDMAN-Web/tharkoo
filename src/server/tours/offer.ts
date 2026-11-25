import { ForbiddenError } from "@/server/http";
import { assertVideoTourAllowed, videoTourPrice } from "@/server/wallet/listing-guard";
import { connectDb } from "@/lib/db";
import { isValidObjectId } from "mongoose";
import { Listing } from "@/server/models";

/**
 * The live video tour offer shown on an ad page: the coin price when a tour can be requested, otherwise null.
 * It uses the same rule as the server's escrow hold, so the button is shown only when the server would accept it.
 * The server stays the authority: a stale or forged button still gets refused on request.
 */
export async function videoTourOffer(listingId: string): Promise<{ coins: number } | null> {
  await connectDb();
  // H21.5b: an owner who turned video calls off for this ad shows no video button.
  const row = isValidObjectId(listingId) ? await Listing.findById(listingId).select("videoCallsOff").lean() : null;
  if (row?.videoCallsOff) return null;
  try {
    await assertVideoTourAllowed(listingId);
  } catch (error) {
    if (error instanceof ForbiddenError) return null;
    throw error;
  }
  return { coins: await videoTourPrice(listingId) };
}
