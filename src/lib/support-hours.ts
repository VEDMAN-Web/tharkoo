const DEFAULT_OPEN_HOUR = 9;
const DEFAULT_CLOSE_HOUR = 21;
const SUPPORT_ZONE = "Asia/Kolkata";
const RANGE = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*(?:to|-|–|until)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i;

export type SupportHours = { openMinutes: number; closeMinutes: number };

function minutesOf(hour: string, minute: string | undefined, meridiem: string): number {
  const base = Number(hour) % 12;
  const shifted = meridiem.toLowerCase() === "pm" ? base + 12 : base;
  return shifted * 60 + Number(minute || 0);
}

export function parseSupportHours(text: string): SupportHours {
  const match = RANGE.exec(text);
  if (!match) return { openMinutes: DEFAULT_OPEN_HOUR * 60, closeMinutes: DEFAULT_CLOSE_HOUR * 60 };
  const open = minutesOf(match[1], match[2], match[3]);
  const close = minutesOf(match[4], match[5], match[6]);
  if (open === close) return { openMinutes: DEFAULT_OPEN_HOUR * 60, closeMinutes: DEFAULT_CLOSE_HOUR * 60 };
  return { openMinutes: open, closeMinutes: close };
}

function minutesNowInZone(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: SUPPORT_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export function isSupportOpen(hours: SupportHours, now: Date): boolean {
  const current = minutesNowInZone(now);
  if (hours.openMinutes < hours.closeMinutes) return current >= hours.openMinutes && current < hours.closeMinutes;
  return current >= hours.openMinutes || current < hours.closeMinutes;
}

export function openingLabel(hours: SupportHours): string {
  const hour24 = Math.floor(hours.openMinutes / 60);
  const minute = hours.openMinutes % 60;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}${minute ? `:${String(minute).padStart(2, "0")}` : ""} ${hour24 >= 12 ? "pm" : "am"}`;
}
