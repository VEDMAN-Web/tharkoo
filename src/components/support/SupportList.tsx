"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, friendlyError, hasSessionHint, type ApiError } from "@/lib/ui/api";
import type { TicketSummary } from "@/server/support/records";
import { StatusChip, formatWhen } from "./labels";

/** The signed-in person's tickets, newest activity first. A row opens its thread beside the list. */
export function SupportList({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) {
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

  if (rows === null) return <p className="up-muted">Loading your tickets...</p>;
  if (error?.code === "UNAUTHORIZED" || !hasSessionHint()) {
    return (
      <p role="status" className="up-muted">
        <Link href="/u/login/?next=/u/account/support/" className="up-link">Sign in</Link> to see your support tickets.
      </p>
    );
  }
  if (error) return <p role="alert" className="up-error">{friendlyError(error)}</p>;
  if (rows.length === 0) return <p className="up-muted">You have no tickets yet. Open one if you need help with coins, your ads or your account.</p>;

  return (
    <ul className="up-ticket-ul" aria-label="Your tickets">
      {rows.map((row) => (
        <li key={row.id}>
          <button
            type="button"
            data-tk="ticket-row"
            aria-current={row.id === selectedId ? "true" : undefined}
            className={row.id === selectedId ? "up-ticket up-ticket-on" : "up-ticket"}
            onClick={() => onSelect(row.id)}
          >
            <span className="up-ticket-top">
              <StatusChip status={row.status} label={row.statusLabel} />
              <span className="up-ticket-ref">#{row.number}</span>
            </span>
            <span className="up-ticket-title">{row.subject}</span>
            <span className="up-ticket-meta">
              {row.topicLabel} · {formatWhen(row.lastMessageAt)}
              {row.unread ? <span data-tk="ticket-unread"> · New reply</span> : null}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
