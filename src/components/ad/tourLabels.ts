/** Plain-text labels for the live video tour screens. No imports: safe in client and server code. */

const DATE_FORMAT = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

/** The contact card button text, for example "Video call and verify, 1 coin". */
export function tourRequestLabel(coins: number): string {
  const unit = coins === 1 ? "coin" : "coins";
  return `Video call and verify, ${coins} ${unit}`;
}

/** "Video verified · 12 Mar 2027" while the badge is still in force, otherwise null. */
export function videoVerifiedLabel(until: Date | string | null | undefined, now: Date = new Date()): string | null {
  if (!until) return null;
  const end = new Date(until);
  if (Number.isNaN(end.getTime()) || end.getTime() <= now.getTime()) return null;
  return `Video verified · ${DATE_FORMAT.format(end)}`;
}

const STATUS_LABELS: Record<string, string> = {
  requested: "Waiting for your answer",
  accepted: "Accepted",
  ending: "Ending",
  completed: "Completed",
  declined: "Declined",
  expired: "Expired",
  failed: "Not paid",
  disputed: "Disputed",
  reversing: "Reversing",
  reversed: "Reversed",
};

export function tourStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? "Unknown";
}

/** The join line for an accepted tour: a link when the room exists, otherwise a plain note. */
export function roomLine(joinUrl: string | null | undefined): { kind: "link"; href: string } | { kind: "note"; text: string } {
  if (joinUrl && /^https:\/\//.test(joinUrl)) return { kind: "link", href: joinUrl };
  return { kind: "note", text: "Room is not set up yet" };
}
