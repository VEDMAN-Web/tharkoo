"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button, EmptyState, PageHeader, Tabs } from "@/components/admin/ui";
import { markAllRead, markRead } from "@/components/admin/notifications/api";
import { NotificationRow } from "@/components/admin/notifications/NotificationRow";
import "@/components/admin/notifications/notifications.css";
import { KIND_LABEL, type NotificationItem, type NotificationKind } from "@/lib/admin/notification-kinds";
import type { NotificationPage } from "@/server/admin/notifications";

const FILTER_TABS = [
  { key: "unread", label: "Unread" },
  { key: "all", label: "All" },
];

/** The Notifications page (H8.53): the bell's list in full, with Unread/All, a kind filter, and pages. */
export function NotificationsView({ data, filter, kind, now }: { data: NotificationPage; filter: "unread" | "all"; kind: NotificationKind | ""; now: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  function go(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    const text = next.toString();
    router.push(`${pathname}${text ? `?${text}` : ""}`, { scroll: false });
  }

  function opened(item: NotificationItem) {
    void markRead(item.key);
  }

  async function readAll() {
    await markAllRead();
    router.refresh();
  }

  return (
    <div className="adm-k adm-nt-page" data-tk="notifications-page">
      <PageHeader crumbs={[{ label: "Today" }]} title="Notifications" purpose="Things waiting for you, newest first. Opening one marks it read and takes you to it." />
      <section className="adm-card adm-nt-card" aria-label="Notifications">
        <Tabs idPrefix="nt" label="Which notifications" active={filter} items={FILTER_TABS} onChange={(key) => go({ filter: key === "unread" ? "unread" : null, page: null })} />
        <div className="adm-nt-tools" style={{ padding: "12px 16px" }}>
          <label className="adm-k-label" htmlFor="nt-kind" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
            Kind
            <select id="nt-kind" className="adm-k-select" value={kind} onChange={(event) => go({ kind: event.target.value || null, page: null })}>
              <option value="">All kinds</option>
              {data.kinds.map((entry) => (
                <option key={entry} value={entry}>{KIND_LABEL[entry]}</option>
              ))}
            </select>
          </label>
          <Button disabled={data.unread === 0} onClick={() => void readAll()}>Mark all as read</Button>
        </div>
        <div role="tabpanel" id={`nt-panel-${filter}`} aria-labelledby={`nt-${filter}`}>
          {data.items.length === 0 ? (
            <EmptyState title="You're all caught up." why={filter === "unread" ? "Nothing unread. Choose All to see older items." : "Nothing is waiting for you."} />
          ) : (
            <ul className="adm-nt-list">
              {data.items.map((item) => (
                <NotificationRow key={item.key} item={item} now={now} onOpen={opened} />
              ))}
            </ul>
          )}
        </div>
        {pages > 1 ? (
          <nav className="adm-nt-pager" aria-label="Pages">
            {data.page > 1 ? <Link className="adm-k-btn" href={`${pathname}?${withPage(params.toString(), data.page - 1)}`}>Previous</Link> : null}
            <span className="adm-k-help">{`Page ${data.page} of ${pages}`}</span>
            {data.page < pages ? <Link className="adm-k-btn" href={`${pathname}?${withPage(params.toString(), data.page + 1)}`}>Next</Link> : null}
          </nav>
        ) : null}
      </section>
    </div>
  );
}

function withPage(query: string, page: number): string {
  const next = new URLSearchParams(query);
  if (page <= 1) next.delete("page");
  else next.set("page", String(page));
  return next.toString();
}
