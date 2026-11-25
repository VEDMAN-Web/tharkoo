/** Plain-text labels for the live video tour screens. No imports: safe in client and server code. */

const DATE_FORMAT = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export function tourRequestLabel(coins: number): string {
  const unit = coins === 1 ? "credit" : "credits";
  return `Video call and verify · ${coins} ${unit}`;
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
  cancelled: "Cancelled",
  expired: "Expired",
  failed: "Not paid",
  disputed: "Disputed",
  reversing: "Reversing",
  reversed: "Reversed",
};

export function tourStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? "Unknown";
}

/** What a buyer sees while a request waits: their place in the line, and a note when the advertiser is on another call. */
export function waitingLine(ahead: number | null | undefined, busy: boolean): string {
  const parts = ["Waiting for the advertiser to answer."];
  if (ahead && ahead > 0) parts.push(`${ahead === 1 ? "1 person is" : `${ahead} people are`} ahead of you in the line.`);
  if (busy) parts.push("The advertiser is on another call.");
  return parts.join(" ");
}

/** A closed request the buyer should be told about. The credit is back in every case here. Null for the ones that need no message. */
export function buyerEndedLine(status: string, failureReason?: string | null): string | null {
  if (status === "failed" && failureReason === "hold-refused") return null;
  if (status === "declined") return "The advertiser could not take your video call. Your credit is back.";
  if (status === "expired") return "Nobody answered your video call request in time. Your credit is back.";
  if (status === "failed") return "Nobody joined your video call in time. Your credit is back.";
  return null;
}

/** The join line for an accepted tour: a link when the room exists, otherwise a plain note. */
export function roomLine(joinUrl: string | null | undefined): { kind: "link"; href: string } | { kind: "note"; text: string } {
  if (joinUrl && /^(https:\/\/|\/u\/account\/tours\/)/.test(joinUrl)) return { kind: "link", href: joinUrl };
  return { kind: "note", text: "Room is not set up yet" };
}
