import { ForbiddenError } from "@/server/http";
import { assertVideoTourAllowed, videoTourPrice } from "@/server/wallet/listing-guard";

/**
 * The live video tour offer shown on an ad page: the coin price when a tour can be requested, otherwise null.
 * It uses the same rule as the server's escrow hold, so the button is shown only when the server would accept it.
 * The server stays the authority: a stale or forged button still gets refused on request.
 */
export async function videoTourOffer(listingId: string): Promise<{ coins: number } | null> {
  try {
    await assertVideoTourAllowed(listingId);
  } catch (error) {
    if (error instanceof ForbiddenError) return null;
    throw error;
  }
  return { coins: await videoTourPrice(listingId) };
}
