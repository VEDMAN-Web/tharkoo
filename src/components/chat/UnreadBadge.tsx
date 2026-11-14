"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/ui/api";

/** Unread message count from /api/chat/unread. Renders nothing at zero or when signed out. */
export function UnreadBadge({ label = "unread messages" }: { label?: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let live = true;
    const read = async () => {
      const res = await api<{ unread: number }>("/api/chat/unread");
      if (live && res.ok) setCount(res.data.unread);
    };
    const first = window.setTimeout(() => void read(), 0);
    const timer = window.setInterval(() => void read(), 30000);
    return () => {
      live = false;
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, []);
  if (count <= 0) return null;
  return (
    <span
      aria-label={`${count} ${label}`}
      data-tk="unread-badge"
      style={{ display: "inline-block", minWidth: 20, padding: "0 6px", borderRadius: 10, background: "var(--accent)", color: "#1a1405", fontSize: 12, fontWeight: 800, textAlign: "center" }}
    >
      {count}
    </span>
  );
}
