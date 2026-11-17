"use client";

import { useState } from "react";
import { CircleUser, Plus, ReceiptText } from "lucide-react";
import { Button } from "@/components/admin/ui";
import { CreditsDialog } from "@/app/admin/users/_credits/CreditsDialog";
import { dateLabel } from "@/app/admin/users/_list/format";
import type { TicketOrder, UserCard as Card } from "./data";

/** The right pane: who the customer is, with Add credits (A14), Open user and Open order. A guest has no account, so the card says so. */
export function UserCard({ card, order, guestName, guest }: { card: Card | null; order: TicketOrder | null; guestName: string; guest?: { email: string; phone: string } | null }) {
  const [adding, setAdding] = useState(false);
  if (!card) {
    return (
      <aside className="adm-card adm-sd-card" aria-label="Customer" data-tk="desk-user">
        <h2>{guestName || "Guest"}</h2>
        {guest?.email || guest?.phone ? (
          <dl className="adm-sd-kvs" data-tk="desk-guest">
            {guest.email ? <div><dt>Email</dt><dd><a href={`mailto:${guest.email}`}>{guest.email}</a></dd></div> : null}
            {guest.phone ? <div><dt>Phone</dt><dd>{guest.phone}</dd></div> : null}
          </dl>
        ) : null}
        <p className="adm-k-help">This person wrote without an account, so there are no credits, orders or ads to show.</p>
      </aside>
    );
  }
  const since = card.memberSince ? `${dateLabel(card.memberSince, new Date(), false)}${card.city ? ` · ${card.city}` : ""}` : card.city ?? "unknown";
  return (
    <aside className="adm-card adm-sd-card" aria-label="Customer" data-tk="desk-user">
      <h2>{card.name}</h2>
      <dl className="adm-sd-kvs">
        <div><dt>Member since</dt><dd>{since}</dd></div>
        <div><dt>Credits</dt><dd data-tk="desk-credits">{card.credits.toLocaleString("en-IN")}</dd></div>
        <div><dt>Orders</dt><dd>{card.ordersWaiting > 0 ? `${card.ordersWaiting} waiting` : `${card.ordersPaid} paid`}</dd></div>
        <div><dt>Ads</dt><dd>{`${card.adsLive} live`}</dd></div>
        <div><dt>Tickets</dt><dd>{`${card.ticketsOpen} open`}</dd></div>
      </dl>
      <div className="adm-sd-actions">
        {card.canAdjust ? (
          <Button icon={Plus} onClick={() => setAdding(true)}>
            Add credits
          </Button>
        ) : null}
        <Button icon={CircleUser} href={`/admin/users/?q=${encodeURIComponent(card.email)}&open=${card.userId}`}>
          Open user
        </Button>
        {order && card.canOpenOrders ? (
          <Button icon={ReceiptText} href={`/admin/finance/?range=all&q=${encodeURIComponent(order.no)}&open=${order.id}`}>
            {`Open order ${order.no}`}
          </Button>
        ) : null}
      </div>
      {card.canAdjust ? <p className="adm-k-help">Adding credits asks for a reason and can be undone for 7 days while unspent.</p> : null}
      {adding ? <CreditsDialog userId={card.userId} name={card.name} balance={card.credits} start={{ mode: "add", amount: "" }} onClose={() => setAdding(false)} /> : null}
    </aside>
  );
}
