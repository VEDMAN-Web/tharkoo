import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { EmptyState, Notice } from "@/components/admin/ui";
import { StatusChip, ageLabel, formatWhen } from "@/components/support/labels";
import { canWorkDesk } from "@/server/support/access";
import { deskQueue, type QueueItem } from "@/server/support/desk";
import { STATUS_LABELS, SUPPORT_PAGE_SIZE, SUPPORT_STATUSES, SUPPORT_TOPICS, TOPIC_LABELS } from "@/server/support/constants";
import { currentDeskActor } from "@/server/support/page-actor";
import { queueQuerySchema, type QueueQuery } from "@/server/support/schemas";

export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;

/** Keeps only the filter keys the queue understands. Any bad value falls back to the default. */
function filtersFrom(raw: Params): QueueQuery {
  const clean: Record<string, string> = {};
  for (const key of ["status", "topic", "owner", "assigned", "page"]) {
    const value = raw[key];
    if (typeof value === "string" && value !== "") clean[key] = value;
  }
  const parsed = queueQuerySchema.safeParse(clean);
  return parsed.success ? parsed.data : queueQuerySchema.parse({});
}

function pageHref(query: QueueQuery, page: number) {
  const params = new URLSearchParams();
  if (query.status !== "active") params.set("status", query.status);
  if (query.topic) params.set("topic", query.topic);
  if (query.owner) params.set("owner", query.owner);
  if (query.assigned) params.set("assigned", query.assigned);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `/admin/support/?${search}` : "/admin/support/";
}

const STATUS_FILTERS = [
  { value: "active", label: "All open (not closed)" },
  ...SUPPORT_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] })),
];

function Filters({ query }: { query: QueueQuery }) {
  return (
    <form method="get" action="/admin/support/" className="adm-card" aria-label="Filter tickets" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", alignItems: "end" }}>
      <label className="adm-field">
        <span className="adm-field-label">Status</span>
        <select name="status" defaultValue={query.status} className="adm-input">
          {STATUS_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
      <label className="adm-field">
        <span className="adm-field-label">Topic</span>
        <select name="topic" defaultValue={query.topic ?? ""} className="adm-input">
          <option value="">All topics</option>
          {SUPPORT_TOPICS.map((value) => (
            <option key={value} value={value}>{TOPIC_LABELS[value]}</option>
          ))}
        </select>
      </label>
      <label className="adm-field">
        <span className="adm-field-label">Customer type</span>
        <select name="owner" defaultValue={query.owner ?? ""} className="adm-input">
          <option value="">Users and vendors</option>
          <option value="user">Users (no ads)</option>
          <option value="vendor">Vendors (have ads)</option>
        </select>
      </label>
      <label className="adm-field" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" name="assigned" value="me" defaultChecked={query.assigned === "me"} />
        <span>Assigned to me</span>
      </label>
      <div>
        <button type="submit" className="adm-btn">Apply filters</button>
      </div>
    </form>
  );
}

function Row({ item, now }: { item: QueueItem; now: number }) {
  const waiting = item.status === "waiting_for_support";
  return (
    <li className="adm-card" data-tk="desk-row" style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
        <Link href={`/admin/support/${item.id}/`} style={{ fontWeight: 700, overflowWrap: "anywhere" }}>
          #{item.number} {item.subject}
        </Link>
        <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {item.unread ? <span className="adm-notice-title" data-tk="desk-unread">New</span> : null}
          <StatusChip status={item.status} label={item.statusLabel} />
        </span>
      </div>
      <p className="t-small text-muted" style={{ margin: 0 }}>
        {item.topicLabel} · {item.ownerName} ({item.ownerKind === "vendor" ? "vendor" : "user"}) · {item.assigned ? `Assigned to ${item.assigneeName}` : "Not assigned"}
      </p>
      <p className="t-small" style={{ margin: 0 }}>
        {waiting ? <strong>Customer waiting {ageLabel(item.waitingSince, now)} for a reply</strong> : <>Last customer message {ageLabel(item.waitingSince, now)} ago</>}
        <span className="text-muted"> · {formatWhen(item.lastMessageAt)}</span>
      </p>
    </li>
  );
}

function Pager({ query, total }: { query: QueueQuery; total: number }) {
  const pages = Math.max(1, Math.ceil(total / SUPPORT_PAGE_SIZE));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pages" className="t-small" style={{ display: "flex", gap: 12, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
      {query.page > 1 ? <Link href={pageHref(query, query.page - 1)}>Previous</Link> : null}
      <span>Page {query.page} of {pages}</span>
      {query.page < pages ? <Link href={pageHref(query, query.page + 1)}>Next</Link> : null}
    </nav>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<Params> }) {
  const actor = await currentDeskActor();
  if (!actor || !canWorkDesk(actor.roles)) {
    return (
      <AdminShell title="Support desk">
        <Notice kind="warn" title="Not for your role">Only support, moderator, admin and superadmin staff can work the support desk.</Notice>
      </AdminShell>
    );
  }
  const query = filtersFrom(await searchParams);
  const result = await deskQueue(actor, query);
  const now = result.now;
  return (
    <AdminShell title="Support desk">
      <p className="mb-3 t-small text-muted">
        Customer tickets. Tickets waiting for support come first, oldest customer message first. {result.total} match these filters.
      </p>
      <div className="adm-stack">
        <Filters query={query} />
        {result.items.length ? (
          <ul className="adm-stack" style={{ listStyle: "none", padding: 0, margin: 0 }} aria-label="Tickets">
            {result.items.map((item) => (
              <Row key={item.id} item={item} now={now} />
            ))}
          </ul>
        ) : (
          <EmptyState title="No tickets here" why="Nothing matches these filters. Change the filters to see other tickets." />
        )}
        <Pager query={query} total={result.total} />
      </div>
    </AdminShell>
  );
}
