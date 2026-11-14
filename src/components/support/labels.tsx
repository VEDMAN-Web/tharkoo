import { SCREENSHOT_MAX_BYTES, SCREENSHOT_MAX_COUNT, TOPIC_LABELS, SUPPORT_TOPICS, type SupportStatus } from "@/server/support/constants";

export const SCREENSHOT_ACCEPT = "image/jpeg,image/png,image/webp";
export const SCREENSHOT_LIMIT_TEXT = `Up to ${SCREENSHOT_MAX_COUNT} screenshots, JPEG, PNG or WebP, ${SCREENSHOT_MAX_BYTES / (1024 * 1024)} MB each.`;

export const TOPIC_OPTIONS = SUPPORT_TOPICS.map((value) => ({ value, label: TOPIC_LABELS[value] }));

const TONE: Record<SupportStatus, { bg: string; color: string }> = {
  open: { bg: "var(--chip)", color: "var(--text)" },
  waiting_for_user: { bg: "var(--warn-bg)", color: "var(--warn)" },
  waiting_for_support: { bg: "var(--ok-bg)", color: "var(--ok)" },
  closed: { bg: "var(--chip)", color: "var(--muted)" },
};

export function StatusChip({ status, label }: { status: SupportStatus; label: string }) {
  const tone = TONE[status];
  return (
    <span
      data-tk="ticket-status"
      data-status={status}
      style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: tone.bg, color: tone.color }}
    >
      {label}
    </span>
  );
}

export function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/** Short age for staff, such as "12 min", "3 h" or "2 days". */
export function ageLabel(iso: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.floor(hours / 24)} days`;
}
