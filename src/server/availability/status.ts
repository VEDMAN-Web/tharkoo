/**
 * H7.5: the "Available now" switch and the Online now / Away badge. Pure, so the rule can be tested without a database.
 *
 * A seller is "online" only when the switch is on AND there was activity within the away window.
 * Otherwise the status is "away". Chat keeps working when away; calls pause (see `callsAllowed`).
 */

export const DEFAULT_AWAY_HOURS = 2;
export const AWAY_HOURS_MIN = 1;
export const AWAY_HOURS_MAX = 24;

export type PresenceStatus = "online" | "away";

export interface PresenceInput {
  available: boolean;
  lastActivityAt: Date | string | null | undefined;
}

/** Clamps an admin-entered number of hours to the allowed range. Anything that is not a number falls back to the default. */
export function clampAwayHours(value: unknown): number {
  const num = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(num)) return DEFAULT_AWAY_HOURS;
  return Math.min(AWAY_HOURS_MAX, Math.max(AWAY_HOURS_MIN, Math.round(num)));
}

/** The status buyers see for one seller at `now`. */
export function presenceStatus(input: PresenceInput, now: number, awayAfterHours: number): PresenceStatus {
  if (!input.available || !input.lastActivityAt) return "away";
  const last = new Date(input.lastActivityAt).getTime();
  if (!Number.isFinite(last)) return "away";
  const windowMs = clampAwayHours(awayAfterHours) * 60 * 60 * 1000;
  return now - last <= windowMs ? "online" : "away";
}

/** Calls are allowed only while online. Chat is always allowed. */
export function callsAllowed(status: PresenceStatus): boolean {
  return status === "online";
}

export function statusLabel(status: PresenceStatus): string {
  return status === "online" ? "Online now" : "Away";
}
