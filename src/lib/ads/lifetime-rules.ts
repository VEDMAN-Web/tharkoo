const HOUR_MS = 60 * 60 * 1000;

/** Ads stay live this long (H7.158). Set in code only; there is no setting for it. */
export const DEFAULT_AD_LIFETIME_HOURS = 48;
export const MIN_AD_LIFETIME_HOURS = 1;
export const MAX_AD_LIFETIME_HOURS = 720;

/** Clamps a value to the allowed range; anything that is not a number gets the default. */
export function clampLifetimeHours(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_AD_LIFETIME_HOURS;
  return Math.min(MAX_AD_LIFETIME_HOURS, Math.max(MIN_AD_LIFETIME_HOURS, Math.round(number)));
}

export function lifetimeMs(hours: number): number {
  return clampLifetimeHours(hours) * HOUR_MS;
}
