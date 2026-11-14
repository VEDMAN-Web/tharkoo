"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, hasSessionHint } from "@/lib/ui/api";

const POLL_MS = 60000;

/** In-app notice for the account dashboard: shows when support has replied and the owner has not opened it yet. */
export function SupportNotice() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!hasSessionHint()) return;
    let live = true;
    const read = async () => {
      const res = await api<{ unread: number }>("/api/support/unread");
      if (live && res.ok) setUnread(res.data.unread);
    };
    const first = window.setTimeout(() => void read(), 0);
    const timer = window.setInterval(() => void read(), POLL_MS);
    return () => {
      live = false;
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, []);

  if (unread <= 0) return null;
  return (
    <div role="status" data-tk="support-notice" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", padding: 12, borderRadius: 10, border: "1px solid var(--accent)", background: "var(--card)" }}>
      <span className="t-body">
        Tharkoo support has replied to {unread === 1 ? "one of your tickets" : `${unread} of your tickets`}.
      </span>
      <Link href="/u/account/support/" className="tk-btn tk-btn-outline-gold tk-btn-sm">Open support</Link>
    </div>
  );
}
