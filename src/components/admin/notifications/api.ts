import type { NotificationPage } from "@/server/admin/notifications";

export async function fetchNotifications(query: string): Promise<NotificationPage | null> {
  try {
    const res = await fetch(`/api/admin/notifications${query}`, { credentials: "same-origin", cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: NotificationPage };
    return body.data ?? null;
  } catch {
    return null;
  }
}

async function post(body: { action: "read"; key: string } | { action: "all" }): Promise<boolean> {
  try {
    // keepalive: an item opens its page at once, and the mark still reaches the server.
    const res = await fetch("/api/admin/notifications", { method: "POST", credentials: "same-origin", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return res.ok;
  } catch {
    return false;
  }
}

export const markRead = (key: string) => post({ action: "read", key });
export const markAllRead = () => post({ action: "all" });
