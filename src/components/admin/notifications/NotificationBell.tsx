"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import type { NotificationItem } from "@/lib/admin/notification-kinds";
import type { NotificationPage } from "@/server/admin/notifications";
import { fetchNotifications, markAllRead, markRead } from "./api";
import { bellBadge } from "./format";
import { NotificationRow } from "./NotificationRow";
import "./notifications.css";

export const BELL_POLL_MS = 60_000;
const PANEL_ITEMS = 8;

/**
 * The bell in the top bar (H8.53). A button that opens a panel of the things this person must act on, newest first.
 * The number is the unread count for this person only. It is read again at most once a minute, and only while the tab is visible.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotificationPage | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();

  const refresh = useCallback(async () => {
    const next = await fetchNotifications(`?size=${PANEL_ITEMS}`);
    if (next) {
      setData(next);
      setNow(Date.now());
    }
  }, []);

  useEffect(() => {
    const first = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, BELL_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const close = useCallback((giveFocusBack: boolean) => {
    setOpen(false);
    if (giveFocusBack) button.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const fresh = window.setTimeout(() => void refresh(), 0);
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
      }
    };
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panel.current?.contains(target) || button.current?.contains(target)) return;
      close(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.clearTimeout(fresh);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, close, refresh]);

  function opened(item: NotificationItem) {
    void markRead(item.key);
    setData((current) => (current ? { ...current, unread: item.unread ? Math.max(0, current.unread - 1) : current.unread, items: current.items.map((row) => (row.key === item.key ? { ...row, unread: false } : row)) } : current));
    setOpen(false);
  }

  async function readAll() {
    setData((current) => (current ? { ...current, unread: 0, items: current.items.map((row) => ({ ...row, unread: false })) } : current));
    await markAllRead();
    void refresh();
  }

  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];
  return (
    <div className="adm-nt-wrap">
      <button
        ref={button}
        type="button"
        className="adm-ibtn"
        data-tk="bell"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${id}-panel` : undefined}
        aria-label={unread ? `Notifications, ${bellBadge(unread)} unread` : "Notifications, none unread"}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell aria-hidden="true" focusable="false" size={18} />
        {unread ? <b aria-hidden="true" data-tk="bell-count">{bellBadge(unread)}</b> : null}
      </button>
      {open ? (
        <div ref={panel} id={`${id}-panel`} className="adm-nt-panel" role="dialog" aria-label="Notifications" tabIndex={-1} data-tk="notifications-panel">
          <div className="adm-nt-head">
            <h2 className="adm-nt-title">Notifications</h2>
            <button type="button" className="adm-nt-link" disabled={unread === 0} onClick={() => void readAll()}>
              Mark all as read
            </button>
            <button type="button" className="adm-nt-close" aria-label="Close notifications" onClick={() => close(true)}>
              <X aria-hidden="true" size={18} />
            </button>
          </div>
          {items.length === 0 ? (
            <p className="adm-nt-empty" data-tk="notifications-empty">You&apos;re all caught up.</p>
          ) : (
            <ul className="adm-nt-list">
              {items.map((item) => (
                <NotificationRow key={item.key} item={item} now={now} onOpen={opened} />
              ))}
            </ul>
          )}
          <div className="adm-nt-foot">
            <Link href="/admin/notifications/" className="adm-nt-link" onClick={() => setOpen(false)}>
              See all
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
