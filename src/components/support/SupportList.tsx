"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, friendlyError, hasSessionHint, type ApiError } from "@/lib/ui/api";
import type { TicketSummary } from "@/server/support/records";
import { StatusChip, formatWhen } from "./labels";

/** The signed-in person's tickets, newest activity first, with status chips and unread marks. */
export function SupportList() {
  const [rows, setRows] = useState<TicketSummary[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let live = true;
    const load = async () => {
      if (!hasSessionHint()) {
        if (live) setRows([]);
        return;
      }
      const res = await api<TicketSummary[]>("/api/support/tickets");
      if (!live) return;
      if (res.ok) setRows(res.data);
      else {
        setRows([]);
        setError(res.error);
      }
    };
    const first = window.setTimeout(() => void load(), 0);
    return () => {
      live = false;
      window.clearTimeout(first);
    };
  }, []);

  if (rows === null) return <p className="t-small">Loading your tickets...</p>;
  if (error?.code === "UNAUTHORIZED" || !hasSessionHint()) {
    return (
      <p role="status" className="t-body">
        <Link href="/u/login/?next=/u/account/support/">Sign in</Link> to see your support tickets.
      </p>
    );
  }
  if (error) return <p role="alert" className="t-body">{friendlyError(error)}</p>;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {rows.length === 0 ? <p className="t-body">You have no tickets yet. Open one if you need help with coins, your ads or your account.</p> : null}
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }} aria-label="Your tickets">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              href={`/u/account/support/${row.id}/`}
              data-tk="ticket-row"
              style={{ display: "grid", gap: 6, padding: 12, borderRadius: 10, border: `1px solid ${row.unread ? "var(--accent)" : "var(--border)"}`, background: "var(--card)", color: "var(--text)", textDecoration: "none" }}
            >
              <span style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
                <strong style={{ overflowWrap: "anywhere" }}>#{row.number} {row.subject}</strong>
                <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {row.unread ? <span data-tk="ticket-unread" style={{ fontSize: 12, fontWeight: 800, color: "var(--accent)" }}>New reply</span> : null}
                  <StatusChip status={row.status} label={row.statusLabel} />
                </span>
              </span>
              <span className="t-small text-muted">
                {row.topicLabel} · Last activity {formatWhen(row.lastMessageAt)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/u/account/support/new/" className="tk-btn tk-btn-primary" style={{ justifySelf: "start" }}>
        New ticket
      </Link>
    </div>
  );
}
