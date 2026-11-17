import type { UserRow } from "@/server/admin/users";

/** Display helpers for the Users screen (H8.8). Pure, so they are tested without a browser. Times are Indian time. */

const IST_MS = 5.5 * 60 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function ist(iso: string) {
  const shifted = new Date(new Date(iso).getTime() + IST_MS);
  return {
    day: shifted.getUTCDate(),
    month: MONTHS[shifted.getUTCMonth()],
    year: shifted.getUTCFullYear(),
    hour: String(shifted.getUTCHours()).padStart(2, "0"),
    minute: String(shifted.getUTCMinutes()).padStart(2, "0"),
  };
}

/** "14 Nov, 18:20" this year, "14 Nov 2025, 18:20" before. With `time` false, only the date. */
export function dateLabel(iso: string | null, now: Date = new Date(), time = true): string {
  if (!iso) return "unknown";
  const t = ist(iso);
  const thisYear = ist(now.toISOString()).year;
  const date = `${t.day} ${t.month}${t.year === thisYear ? "" : ` ${t.year}`}`;
  return time ? `${date}, ${t.hour}:${t.minute}` : date;
}

/** "41 min ago", "2 h 10 min ago", then the date. Nothing known reads "never". */
export function lastSeenLabel(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "never";
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0 ? `${hours} h ago` : `${hours} h ${rest} min ago`;
  }
  return dateLabel(iso, now);
}

/** "priya.s@..." : enough to tell people apart in a list. The drawer shows the whole address. */
export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  return `${name.length > 7 ? name.slice(0, 7) : name}@\u2026`;
}

export type StatusLook = { tone: "ok" | "warn" | "bad" | "info" | "pri" | "neutral"; text: string };

/** One badge for the list: banned first, then the ID check, then plain active. Text is always inside the badge. */
export function statusLook(row: Pick<UserRow, "status" | "verification" | "roles" | "city">): StatusLook {
  if (row.status === "suspended") return { tone: "bad", text: "Banned" };
  if (row.status === "deleted") return { tone: "neutral", text: "Deleted" };
  if (row.verification === "pending_review") return { tone: "warn", text: "ID waiting" };
  if (row.verification === "approved") return { tone: "ok", text: "ID verified" };
  if (row.verification === "rejected") return { tone: "bad", text: "ID refused" };
  return row.city ? { tone: "neutral", text: "ID not done" } : { tone: "ok", text: "Active" };
}

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  moderator: "Moderator",
  trust_safety: "Trust and safety",
  support: "Support",
  finance: "Finance",
  seo_editor: "SEO editor",
  blog_editor: "Blog editor",
  content_editor: "Content editor",
};

/** The staff role names of a user, in words. Empty for a normal user. */
export function staffRoleLabels(roles: readonly string[]): string[] {
  return roles.filter((role) => role in ROLE_LABELS).map((role) => ROLE_LABELS[role]);
}

/** The small grey line under a name: masked address and what they are. */
export function subLine(row: Pick<UserRow, "email" | "roles" | "city">): string {
  const staff = staffRoleLabels(row.roles);
  const kind = staff.length ? staff.join(", ").toLowerCase() : row.city ? "seller" : "member";
  return `${maskEmail(row.email)} \u00b7 ${kind}`;
}
