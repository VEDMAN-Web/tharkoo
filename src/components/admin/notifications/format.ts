const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now", "5 min ago", "3 h ago", "2 d ago". */
export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} h ago`;
  return `${Math.floor(diff / DAY)} d ago`;
}

/** "Due in 3 h", "Due in 20 min", "Overdue by 2 h". */
export function dueLabel(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  const size = Math.abs(diff);
  const amount = size < HOUR ? `${Math.max(1, Math.floor(size / MINUTE))} min` : size < DAY ? `${Math.floor(size / HOUR)} h` : `${Math.floor(size / DAY)} d`;
  return diff >= 0 ? `Due in ${amount}` : `Overdue by ${amount}`;
}

/** The number on the bell: nothing at 0, then 1 to 9, then "9+". */
export function bellBadge(unread: number): string {
  return unread > 9 ? "9+" : String(unread);
}
