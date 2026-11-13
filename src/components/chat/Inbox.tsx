"use client";

import { useEffect, useState } from "react";
import { api, friendlyError } from "@/lib/ui/api";
import { ChatThread } from "./ChatThread";

type Row = { id: string; listingTitle: string; role: "buyer" | "seller"; lastText: string; lastMessageAt: string; unread: number; blocked: boolean };

/** The Messages inbox: a list of conversations, and the open chat beside or below it. */
export function Inbox() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState("");

  useEffect(() => {
    let live = true;
    const read = async () => {
      const res = await api<Row[]>("/api/chat/conversations");
      if (!live) return;
      if (res.ok) setRows(res.data);
      else {
        setRows([]);
        setError(res.status === 401 ? "Sign in to see your messages." : friendlyError(res.error));
      }
    };
    const first = window.setTimeout(() => void read(), 0);
    const timer = window.setInterval(() => void read(), 15000);
    return () => {
      live = false;
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, []);

  if (rows === null) return <p className="t-small">Loading messages...</p>;
  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", alignItems: "start" }}>
      <section aria-label="Conversations">
        {error ? <p role="alert">{error}</p> : null}
        {!error && rows.length === 0 ? <p className="t-body">No messages yet. When someone taps Chat now on your ad, it appears here.</p> : null}
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => setOpenId(row.id)}
                aria-current={openId === row.id}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: 12,
                  minHeight: 48,
                  borderRadius: 10,
                  border: `1px solid ${openId === row.id ? "var(--accent)" : "var(--border)"}`,
                  background: "var(--card)",
                  color: "var(--text)",
                  display: "grid",
                  gap: 2,
                }}
              >
                <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.listingTitle || "Ad"}</strong>
                  {row.unread > 0 ? (
                    <span aria-label={`${row.unread} unread`} style={{ background: "var(--accent)", color: "#1a1405", borderRadius: 10, padding: "0 8px", fontSize: 12, fontWeight: 800 }}>
                      {row.unread}
                    </span>
                  ) : null}
                </span>
                <span className="t-small" style={{ color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {row.blocked ? "Blocked" : row.lastText || "No messages yet"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      {openId ? (
        <section aria-label="Conversation" style={{ border: "1px solid var(--border)", borderRadius: 12, background: "var(--card)", height: "min(70vh, 560px)" }}>
          <ChatThread key={openId} conversationId={openId} />
        </section>
      ) : null}
    </div>
  );
}
