import { Site } from "@/server/models";

const HOUR_MS = 60 * 60 * 1000;

/** Ads stay live this long unless an admin changes "Ad lifetime (hours)" (H6.7). */
export const DEFAULT_AD_LIFETIME_HOURS = 72;
export const MIN_AD_LIFETIME_HOURS = 1;
export const MAX_AD_LIFETIME_HOURS = 720;

/** Clamps an admin value to the allowed range; anything that is not a number gets the default. */
export function clampLifetimeHours(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_AD_LIFETIME_HOURS;
  return Math.min(MAX_AD_LIFETIME_HOURS, Math.max(MIN_AD_LIFETIME_HOURS, Math.round(number)));
}

export function lifetimeMs(hours: number): number {
  return clampLifetimeHours(hours) * HOUR_MS;
}

/** The lifetime in force now, read from the site settings. Used for new ads, renewals and approvals. */
export async function adLifetimeMs(): Promise<number> {
  const site = await Site.findOne({ key: "default" }).select("adLifetimeHours").lean<{ adLifetimeHours?: number }>();
  return lifetimeMs(site?.adLifetimeHours ?? DEFAULT_AD_LIFETIME_HOURS);
}
