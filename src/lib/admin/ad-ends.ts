const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const IST = "Asia/Kolkata";
const IST_OFFSET = "+05:30";

/** "14 Nov, 06:30 pm" in India time. */
export function istDateTime(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: IST });
  const time = date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: IST });
  return `${day}, ${time}`;
}

/** "in 5 h", "in 12 min", "in 3 days", or "ended". */
export function endsIn(iso: string, now: number): string {
  const left = new Date(iso).getTime() - now;
  if (left <= 0) return "ended";
  if (left < HOUR_MS) return `in ${Math.max(1, Math.ceil(left / MINUTE_MS))} min`;
  if (left < 2 * DAY_MS) return `in ${Math.round(left / HOUR_MS)} h`;
  return `in ${Math.round(left / DAY_MS)} days`;
}

/** The value a date and time input shows for a moment, in India time: "2026-11-14T18:30". */
export function istInputValue(iso: string): string {
  const shifted = new Date(new Date(iso).getTime() + 5.5 * HOUR_MS);
  return shifted.toISOString().slice(0, 16);
}

/** What a date and time input holds ("2026-11-14T18:30", read as India time) as an ISO moment, or null when it is not a date. */
export function istInputToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00${IST_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
