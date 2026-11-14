/**
 * A paid boost never runs past its ad's expiry (H6.7). The simpler of the two options was chosen:
 * a boost that would end after the ad expires is refused at purchase, and an auto-renewal that would
 * end after expiry is switched off. No partial charges.
 */
export function boostFitsBeforeExpiry(endsAt: Date, expiresAt?: Date | null): boolean {
  if (!expiresAt) return true;
  return endsAt.getTime() <= new Date(expiresAt).getTime();
}
