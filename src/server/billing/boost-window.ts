/**
 * H11.1: a plan can run past the end of its ad. Then the ad's end moves to the plan's end, so nobody pays for 72 hours on an ad
 * that ends sooner. This returns the new end of the ad, or null when the plan ends before the ad does (nothing to move).
 */
export function extendedAdEnd(planEndsAt: Date, adExpiresAt?: Date | null): Date | null {
  if (!adExpiresAt) return null;
  return planEndsAt.getTime() > new Date(adExpiresAt).getTime() ? planEndsAt : null;
}

/** True when the plan ends no later than the ad (H6.7). Kept for callers that only need the check. */
export function boostFitsBeforeExpiry(endsAt: Date, expiresAt?: Date | null): boolean {
  if (!expiresAt) return true;
  return endsAt.getTime() <= new Date(expiresAt).getTime();
}
