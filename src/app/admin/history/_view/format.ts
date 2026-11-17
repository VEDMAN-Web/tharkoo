import type { RowState } from "@/server/admin/history";

/** Display helpers for the History & undo screen (H8.26). Pure, so they are tested without a browser. Times are Indian time. */

const IST_MS = 5.5 * 60 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(iso: string) {
  const shifted = new Date(new Date(iso).getTime() + IST_MS);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth(), day: shifted.getUTCDate(), time: `${String(shifted.getUTCHours()).padStart(2, "0")}:${String(shifted.getUTCMinutes()).padStart(2, "0")}` };
}

/** "00:12" today, "Yesterday 23:58", then "14 Nov, 18:20" (with the year when it is not this one). */
export function whenLabel(iso: string, now: Date = new Date()): string {
  const at = parts(iso);
  const today = parts(now.toISOString());
  const dayNumber = (p: ReturnType<typeof parts>) => Date.UTC(p.year, p.month, p.day);
  const gap = Math.round((dayNumber(today) - dayNumber(at)) / (24 * 60 * 60 * 1000));
  if (gap === 0) return at.time;
  if (gap === 1) return `Yesterday ${at.time}`;
  return `${at.day} ${MONTHS[at.month]}${at.year === today.year ? "" : ` ${at.year}`}, ${at.time}`;
}

export const STATE_BADGE: Record<RowState, { tone: "ok" | "info" | "bad" | "neutral" | "warn"; text: string } | null> = {
  can_undo: { tone: "ok", text: "Can undo" },
  restore: { tone: "info", text: "Restore" },
  undone: { tone: "neutral", text: "Undone" },
  locked: { tone: "bad", text: "Locked" },
  expired: { tone: "neutral", text: "Time passed" },
  not_yours: { tone: "neutral", text: "Not for your role" },
  not_built: { tone: "neutral", text: "Not available yet" },
  none: null,
};

/** What the toast says after a button: "User unbanned", "Restored v13", "Done again", "Undone". */
export function doneWords(label: string): string {
  if (label === "Redo") return "Done again.";
  if (label === "Unban") return "User unbanned.";
  if (/^Restore v\d+$/.test(label)) return `${label.replace("Restore", "Restored")}.`;
  return "Undone.";
}

/** The grey line under a change: who did it, with the role. */
export function whoLine(who: string, role: string): string {
  return role ? `${who} · ${role}` : who;
}
