import { clampLifetimeHours, DEFAULT_AD_LIFETIME_HOURS, lifetimeMs, MAX_AD_LIFETIME_HOURS, MIN_AD_LIFETIME_HOURS } from "@/lib/ads/lifetime-rules";

export { clampLifetimeHours, DEFAULT_AD_LIFETIME_HOURS, lifetimeMs, MAX_AD_LIFETIME_HOURS, MIN_AD_LIFETIME_HOURS };

/**
 * The lifetime for new ads, renewals and approvals: the code constant. A `Site.adLifetimeHours` value saved earlier (72 by the old schema
 * default) is ignored on purpose, so every ad gets 48 hours. Ads that are live keep their end time; an admin changes one in Ads.
 */
export async function adLifetimeMs(): Promise<number> {
  return lifetimeMs(DEFAULT_AD_LIFETIME_HOURS);
}
