"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Badge, EmptyState, FilterBar, PageHeader, Tabs, ToastProvider } from "@/components/admin/ui";
import { ageLabel } from "@/components/support/labels";
import type { QueueItem } from "@/server/support/desk";
import type { MessageView, TicketSummary } from "@/server/support/records";
import type { DeskTab, TicketOrder, UserCard as Card } from "./data";
import { overLabel } from "./age";
import { ThreadPane } from "./ThreadPane";
import { UserCard } from "./UserCard";
import "./desk.css";

const TAB_LABELS: Record<DeskTab, string> = { open: "Open", waiting: "Waiting on user", closed: "Closed" };
const SEARCH_DEBOUNCE_MS = 350;

export type OpenThread = { ticket: TicketSummary; customer: string; messages: MessageView[]; staff: { id: string; name: string }[]; card: Card | null; order: TicketOrder | null; guest: { email: string; phone: string } | null };

/** The support desk (H8.43): tickets on the left, the open ticket in the middle, the customer on the right. Tab, search and the open ticket live in the address. */
export function DeskView({ tab, counts, unseen, items, now, q, ticketId, thread, viewerId }: { tab: DeskTab; counts: Record<DeskTab, number>; unseen: number; items: QueueItem[]; now: number; q: string; ticketId: string; thread: OpenThread | null; viewerId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [search, setSearch] = useState(q);
  const sent = useRef(q);

  function go(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    const text = next.toString();
    router.push(`${pathname}${text ? `?${text}` : ""}`, { scroll: false });
  }

  useEffect(() => {
    if (search.trim() === sent.current) return;
    const id = window.setTimeout(() => {
      sent.current = search.trim();
      go({ q: search.trim() || null });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <ToastProvider>
      <div className="adm-k" data-tk="desk" data-open={thread ? "yes" : "no"}>
        <PageHeader crumbs={[{ label: "Queues" }]} title="Support desk" purpose="Oldest first. Replies go by email and to the user's account." />
        <div className="adm-sd-grid">
          <section className="adm-card adm-sd-list" aria-label="Tickets" data-tk="desk-list">
            <Tabs
              idPrefix="desk"
              label="Ticket lists"
              active={tab}
              items={(Object.keys(TAB_LABELS) as DeskTab[]).map((key) =>
                key === "open"
                  ? // The total is plain grey text; only the red number is what nobody has opened yet.
                    { key, label: counts.open ? `Open ${counts.open}` : "Open", count: unseen || undefined }
                  : { key, label: TAB_LABELS[key], count: counts[key] || undefined },
              )}
              onChange={(key) => go({ tab: key === "open" ? null : key, ticket: null })}
            />
            <div role="tabpanel" id={`desk-panel-${tab}`} aria-labelledby={`desk-${tab}`}>
            <FilterBar search={search} onSearch={setSearch} searchLabel="Search tickets" placeholder="Search tickets" chips={[]} onRemoveChip={() => undefined} />
            {items.length === 0 ? (
              <EmptyState title="No tickets here" why={q ? "Nothing matches this search." : "Nothing is waiting in this list."} />
            ) : (
              <ul className="adm-sd-rows">
                {items.map((item) => {
                  const over = overLabel(item.status, item.lastCustomerMessageAt, now);
                  return (
                    <li key={item.id}>
                      <button type="button" className="adm-sd-row" data-tk="desk-row" aria-current={item.id === ticketId ? "true" : undefined} onClick={() => go({ ticket: item.id })}>
                        <span className="adm-sd-rowtitle">
                          <strong>{item.subject}</strong>
                          {over ? <Badge tone="bad">{over}</Badge> : item.status === "waiting_for_support" ? <Badge tone="warn">Waiting</Badge> : item.unread ? <Badge tone="info">New</Badge> : null}
                        </span>
                        <small>{`${item.ownerName} · ${item.topicLabel} · ${ageLabel(item.waitingSince, now)}`}</small>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            </div>
          </section>
          {thread ? (
            <>
              <div className="adm-sd-mid">
                <button type="button" className="adm-sd-back" onClick={() => go({ ticket: null })}>
                  <ChevronLeft aria-hidden="true" size={16} /> All tickets
                </button>
                <ThreadPane key={thread.ticket.id} ticket={thread.ticket} customer={thread.customer} messages={thread.messages} staff={thread.staff} viewerId={viewerId} order={thread.order} now={now} />
              </div>
              <UserCard card={thread.card} order={thread.order} guestName={thread.customer} guest={thread.guest} />
            </>
          ) : (
            <section className="adm-card adm-sd-empty" data-tk="desk-pick">
              <EmptyState title="Pick a ticket" why="Choose a ticket on the left to read it and answer." />
            </section>
          )}
        </div>
      </div>
    </ToastProvider>
  );
}
