"use client";

import Link from "next/link";
import { useState } from "react";
import { SupportList } from "@/components/support/SupportList";
import { TicketThread } from "@/components/support/TicketThread";
import type { PanelSummary } from "@/server/notifications/summary";
import { SignedOutPanel, UserPanelShell } from "./UserPanelShell";

/** H7.17: help and support on the user panel: the ticket list on the left, the thread on the right. */
export function SupportPanel({ summary, initialId = null }: { summary: PanelSummary; initialId?: string | null }) {
  const [selected, setSelected] = useState<string | null>(initialId);
  if (!summary.signedIn) {
    return (
      <UserPanelShell active="support" summary={summary}>
        <SignedOutPanel next="/u/account/support/" title="Log in to see your tickets" body="Your support tickets are kept on your account." />
      </UserPanelShell>
    );
  }
  return (
    <UserPanelShell active="support" summary={summary}>
      <section aria-labelledby="support-title" className="up-glass up-panel">
        <div className="up-panel-head">
          <div>
            <h1 id="support-title" className="up-h2">Help and support</h1>
            <p className="up-muted">We usually reply within a few hours</p>
          </div>
          <Link href="/u/account/support/new/" className="up-btn">New ticket</Link>
        </div>
      </section>
      <div className="up-tickets">
        <section aria-label="Your tickets" className="up-glass up-ticket-list">
          <p className="up-ticket-label">Your tickets</p>
          <SupportList selectedId={selected} onSelect={setSelected} />
        </section>
        <section aria-label="Ticket thread" className="up-glass up-thread">
          {selected ? (
            <div className="up-thread-body">
              <TicketThread ticketId={selected} />
            </div>
          ) : (
            <div className="up-empty">
              <div className="up-empty-box" aria-hidden="true" />
              <p className="up-empty-title">Choose a ticket</p>
              <p className="up-empty-body">Pick a ticket on the left to read it and reply.</p>
            </div>
          )}
        </section>
      </div>
    </UserPanelShell>
  );
}
