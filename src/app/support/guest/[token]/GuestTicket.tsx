"use client";

import { useEffect, useState } from "react";
import { api, friendlyError } from "@/lib/ui/api";

type Message = { id: string; authorType: "user" | "staff"; body: string; createdAt: string };
type Thread = {
  ticket: { number: number; subject: string; statusLabel: string; closedAt: string | null };
  messages: Message[];
};

/**
 * H7.1: the guest's own ticket. The token comes from the page path and is sent in the JSON body only,
 * so it is not in any URL the browser requests from the API.
 */
export function GuestTicket({ token }: { token: string }) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api<Thread>("/api/support/guest/thread", { method: "POST", body: JSON.stringify({ t: token }) }).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setThread(res.data);
        setError("");
      } else {
        setError(friendlyError(res.error));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [token, version]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) {
      setError("Write a reply first.");
      return;
    }
    setBusy(true);
    setError("");
    const res = await api("/api/support/guest/reply", { method: "POST", body: JSON.stringify({ t: token, body }) });
    setBusy(false);
    if (!res.ok) return setError(friendlyError(res.error));
    setDraft("");
    setVersion((n) => n + 1);
  }

  if (!thread) {
    return <p role="status">{error || "Loading your ticket..."}</p>;
  }
  const closed = Boolean(thread.ticket.closedAt);
  return (
    <section aria-labelledby="guest-ticket-title">
      <h1 id="guest-ticket-title" style={{ fontSize: 24, margin: "0 0 4px" }}>Support ticket #{thread.ticket.number}</h1>
      <p style={{ margin: "0 0 16px" }}>
        {thread.ticket.subject} · {thread.ticket.statusLabel}
      </p>
      <ol style={{ listStyle: "none", padding: 0, margin: "0 0 20px", display: "grid", gap: 10 }}>
        {thread.messages.map((message) => (
          <li
            key={message.id}
            style={{
              justifySelf: message.authorType === "staff" ? "start" : "end",
              maxWidth: "85%",
              padding: "10px 14px",
              borderRadius: 16,
              background: message.authorType === "staff" ? "#fff" : "#fdf0f7",
              border: "1px solid #ead8f0",
              whiteSpace: "pre-wrap",
            }}
          >
            <span style={{ display: "block", fontSize: 12, color: "#4a2870" }}>
              {message.authorType === "staff" ? "Tharkoo support" : "You"}
            </span>
            {message.body}
          </li>
        ))}
      </ol>
      {closed ? (
        <p>This ticket is closed. Open a new ticket on the site if you still need help.</p>
      ) : (
        <form onSubmit={send} style={{ display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
            Reply
            <textarea name="reply" rows={4} maxLength={4000} value={draft} onChange={(event) => setDraft(event.target.value)} style={{ font: "inherit", padding: 12, borderRadius: 12, border: "1.5px solid #ead8f0" }} />
          </label>
          <button type="submit" disabled={busy} style={{ minHeight: 48, borderRadius: 12, border: 0, color: "#fff", fontWeight: 700, background: "linear-gradient(135deg,#d1137a,#a8124f)", cursor: "pointer" }}>
            {busy ? "Sending..." : "Send reply"}
          </button>
        </form>
      )}
      {error ? <p role="alert" style={{ color: "#b91c1c", fontWeight: 600 }}>{error}</p> : null}
    </section>
  );
}
