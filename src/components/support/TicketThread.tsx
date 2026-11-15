"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, friendlyError, hasSessionHint, type ApiError } from "@/lib/ui/api";
import type { MessageView, TicketSummary } from "@/server/support/records";
import { SCREENSHOT_ACCEPT, SCREENSHOT_LIMIT_TEXT, StatusChip, formatWhen } from "./labels";
import { postForm } from "./request";

type Thread = { ticket: TicketSummary; messages: MessageView[] };

const POLL_MS = 30000;

/** One ticket for its owner. Internal notes are never in this response. A closed ticket is read only. */
export function TicketThread({ ticketId }: { ticketId: string }) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    if (!hasSessionHint()) {
      setError({ code: "UNAUTHORIZED", message: "Sign in required" });
      return;
    }
    const res = await api<Thread>(`/api/support/tickets/${ticketId}`);
    if (res.ok) {
      setThread(res.data);
      setError(null);
    } else setError(res.error);
  }, [ticketId]);

  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [load]);

  if (error?.code === "UNAUTHORIZED") {
    return <p role="status" className="t-body"><Link href="/u/login/?next=/u/account/support/">Sign in</Link> to read this ticket.</p>;
  }
  if (error?.code === "NOT_FOUND") return <p role="alert" className="t-body">This ticket was not found.</p>;
  if (error) return <p role="alert" className="t-body">{friendlyError(error)}</p>;
  if (!thread) return <p className="t-small">Loading the ticket...</p>;

  const { ticket, messages } = thread;
  const closed = ticket.status === "closed";
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <header style={{ display: "grid", gap: 6 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <h1 className="t-h2" style={{ margin: 0, overflowWrap: "anywhere" }}>#{ticket.number} {ticket.subject}</h1>
          <StatusChip status={ticket.status} label={ticket.statusLabel} />
        </div>
        <p className="t-small text-muted" style={{ margin: 0 }}>{ticket.topicLabel}</p>
      </header>

      <ol aria-label="Messages" style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
        {messages.map((message) => (
          <li key={message.id} data-tk="ticket-message" data-author={message.authorType} style={{ display: "grid", gap: 6, padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: message.authorType === "staff" ? "var(--card)" : "transparent", justifySelf: "stretch" }}>
            <span className="t-small text-muted">
              <strong>{message.authorType === "staff" ? "Tharkoo support" : "You"}</strong> · {formatWhen(message.createdAt)}
            </span>
            {message.body ? <p className="t-body" style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{message.body}</p> : null}
            {message.attachments.length ? <Screenshots ids={message.attachments} /> : null}
          </li>
        ))}
      </ol>

      {closed ? (
        <section aria-label="Ticket closed" style={{ display: "grid", gap: 10, padding: 12, borderRadius: 10, border: "1px solid var(--border)" }}>
          <p className="t-body" style={{ margin: 0 }}>This ticket is closed. You can read it, but you cannot reply.</p>
          <Link href="/u/account/support/new/" className="tk-btn tk-btn-outline-primary" style={{ justifySelf: "start" }}>Open a new ticket</Link>
        </section>
      ) : (
        <Reply ticketId={ticketId} onSent={load} />
      )}
    </div>
  );
}

function Screenshots({ ids }: { ids: string[] }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {ids.map((id, index) => (
        <img
          key={id}
          src={`/api/support/attachments/${id}`}
          alt={`Screenshot ${index + 1}`}
          loading="lazy"
          style={{ width: 160, maxWidth: "100%", height: "auto", borderRadius: 8, border: "1px solid var(--border)" }}
        />
      ))}
    </div>
  );
}

function Reply({ ticketId, onSent }: { ticketId: string; onSent: () => Promise<void> }) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!body.trim() && files.length === 0) return setError("Write a reply or attach a screenshot.");
    setError("");
    setBusy(true);
    const form = new FormData();
    form.append("body", body);
    for (const file of files) form.append("screenshots", file);
    const res = await postForm(`/api/support/tickets/${ticketId}/messages`, form);
    setBusy(false);
    if (!res.ok) return setError(friendlyError(res.error));
    setBody("");
    setFiles([]);
    await onSent();
  }

  return (
    <form onSubmit={send} aria-label="Reply" style={{ display: "grid", gap: 10 }}>
      <label htmlFor="ticket-reply" className="t-small"><strong>Reply</strong></label>
      <textarea id="ticket-reply" rows={4} maxLength={4000} value={body} onChange={(event) => setBody(event.target.value)} className="tk-field" style={{ padding: "8px 12px" }} />
      <label htmlFor="ticket-reply-shots" className="t-small">Add screenshots (optional)</label>
      <input id="ticket-reply-shots" type="file" multiple accept={SCREENSHOT_ACCEPT} onChange={(event) => setFiles(Array.from(event.target.files ?? []))} aria-describedby="ticket-reply-shots-help" />
      <span id="ticket-reply-shots-help" className="t-small text-muted">{SCREENSHOT_LIMIT_TEXT}</span>
      {error ? <p role="alert" className="t-small" style={{ color: "var(--danger, #b42318)", margin: 0 }}>{error}</p> : null}
      <div>
        <button type="submit" className="tk-btn tk-btn-primary" disabled={busy}>{busy ? "Sending..." : "Send reply"}</button>
      </div>
    </form>
  );
}
