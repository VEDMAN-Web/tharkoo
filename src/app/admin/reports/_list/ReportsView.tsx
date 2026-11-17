"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { History, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Drawer, EmptyState, FilterBar, MoreMenu, PageHeader, ReasonDialog, ServerTable, Tabs, ToastProvider, useToast, type BadgeTone, type MoreItem, type TableColumn } from "@/components/admin/ui";
import type { ReportDetail, ReportList, ReportRow, ReportTab } from "@/server/admin/reports";
import { reportActAction, undoReportAction } from "../_actions/actions";
import { TakedownDialog } from "./TakedownDialog";
import "./reports.css";

type Access = { legal: boolean; ban: boolean; decide: boolean };
type Remove = { ban: boolean };

const TAB_LABELS: Record<ReportTab, string> = { open: "Open", legal: "Legal takedown", closed: "Closed" };
const SEARCH_DEBOUNCE_MS = 350;
const MIN_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

function span(ms: number) {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < MIN_PER_HOUR) return `${minutes} min`;
  const hours = Math.floor(minutes / MIN_PER_HOUR);
  if (hours < HOURS_PER_DAY) return `${hours} h`;
  return `${Math.floor(hours / HOURS_PER_DAY)} d`;
}

function ago(iso: string) {
  return span(Date.now() - new Date(iso).getTime());
}

function clock(row: ReportRow): { tone: BadgeTone; text: string } {
  if (row.dueAt) {
    const left = new Date(row.dueAt).getTime() - Date.now();
    if (row.status === "ack") return { tone: "info", text: "Acknowledged" };
    return left < 0 ? { tone: "bad", text: `Overdue ${span(-left)}` } : { tone: "warn", text: `Due in ${span(left)}` };
  }
  if (row.outcome) return { tone: row.status === "actioned" ? "ok" : "neutral", text: row.outcome };
  return row.urgent ? { tone: "bad", text: "Urgent" } : { tone: "info", text: "New" };
}

function Screen({ list, detail, access }: { list: ReportList; detail: ReportDetail | null; access: Access }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const { tab } = list.query;
  const [search, setSearch] = useState(list.query.q);
  const sentSearch = useRef(list.query.q);
  const [note, setNote] = useState("");
  const [removing, setRemoving] = useState<Remove | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);

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
    if (search.trim() === sentSearch.current) return;
    const id = window.setTimeout(() => {
      sentSearch.current = search.trim();
      go({ q: search.trim() || null, page: null, open: null });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function undo(ids: string[]) {
    const answer = await undoReportAction(ids);
    toast.show({ kind: answer.ok ? "success" : "error", message: answer.message });
    router.refresh();
  }

  async function act(action: "dismiss" | "pause" | "remove" | "removeBan" | "ack" | "close" | "reopen", refund = false) {
    if (!detail) return;
    setBusy(true);
    const answer = await reportActAction({ tab, id: detail.id, action, note, refund });
    setBusy(false);
    if (!answer.ok) {
      toast.show({ kind: "error", message: answer.message });
      return;
    }
    setNote("");
    toast.show({ kind: "undo", message: `${answer.summary}.`, onUndo: () => void undo(answer.eventIds) });
    go({ open: null });
    router.refresh();
  }

  const columns: TableColumn<ReportRow>[] = [
    {
      key: "report",
      header: "Report",
      primary: true,
      cell: (row) => (
        <>
          <strong>{row.reason + ": " + row.title}</strong>
          <small>{[row.category, row.city].filter(Boolean).join(" · ")}</small>
        </>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => {
        const look = clock(row);
        return <Badge tone={look.tone}>{look.text}</Badge>;
      },
    },
    { key: "count", header: "Count", hideOnPhone: true, nowrap: true, cell: (row) => (tab === "open" ? `${row.count} ${row.count === 1 ? "report" : "reports"}` : row.reason === "Legal request" ? "Legal request" : "1 report") },
    { key: "wait", header: "Waiting", nowrap: true, cell: (row) => <span title={new Date(row.since).toLocaleString("en-IN")}>{ago(row.since)}</span> },
  ];

  const tabs = (Object.keys(TAB_LABELS) as ReportTab[]).filter((key) => key !== "legal" || access.legal);
  const searching = list.query.q !== "";
  const more: MoreItem[] = [];
  if (detail && tab === "open" && access.decide && detail.adStatus === "active") {
    more.push({ key: "pause", label: "Pause ad", onSelect: () => void act("pause") });
    if (access.ban) more.push({ key: "ban", label: "Remove ad and ban seller...", danger: true, onSelect: () => setRemoving({ ban: true }) });
  }
  const closedRow = tab === "closed";
  return (
    <div className="adm-k" data-tk="reports-screen">
      <PageHeader
        crumbs={[{ label: "Queues" }]}
        title="Reports"
        purpose="Reports from users and legal takedown requests. Act on the ad and the seller from here."
        secondary={[{ key: "history", label: "History", icon: History, href: "/admin/history/" }]}
        primary={tab === "legal" && access.legal ? { key: "add-takedown", label: "Add takedown", icon: Plus, kind: "primary", onClick: () => setAdding(true) } : undefined}
      />
      <div className="adm-card" style={{ padding: 0, overflow: "clip", marginBottom: 16 }}>
        <Tabs
          idPrefix="reports"
          label="Reports"
          active={tab}
          items={tabs.map((key) => ({ key, label: TAB_LABELS[key], count: list.counts[key] }))}
          onChange={(key) => go({ tab: key === "open" ? null : key, page: null, open: null, q: null })}
        />
        <div role="tabpanel" id={`reports-panel-${tab}`} aria-labelledby={`reports-${tab}`}>
          <FilterBar search={search} onSearch={setSearch} searchLabel="Search reports" placeholder="Ad title" chips={[]} onRemoveChip={() => undefined} />
          <ServerTable
            label={TAB_LABELS[tab]}
            columns={columns}
            rows={list.rows}
            rowId={(row) => row.id}
            rowLabel={(row) => row.title || "report"}
            total={list.total}
            page={list.query.page}
            pageSize={list.query.pageSize}
            onPage={(page) => go({ page: page === 1 ? null : String(page), open: null })}
            onPageSize={(size) => go({ size: size === 25 ? null : String(size), page: null, open: null })}
            openId={detail?.id ?? null}
            onOpen={(row) => go({ open: row.id })}
            empty={
              <EmptyState
                title={searching ? `No reports match "${list.query.q}"` : tab === "legal" ? "No legal requests waiting" : tab === "closed" ? "Nothing closed yet" : "No reports waiting"}
                why={searching ? "Try the first letters of the ad title." : "New reports show up here as soon as someone sends one."}
              />
            }
          />
        </div>
      </div>
      {detail ? (
        <Drawer
          open
          title={detail.title || "(no title)"}
          subtitle={`${detail.reports.length} ${detail.reports.length === 1 ? "report" : "reports"}${detail.legal ? " · legal request" : ""}`}
          onClose={() => {
            setNote("");
            go({ open: null });
          }}
          footer={
            closedRow ? (
              <>
                <span className="adm-k-sp" />
                <Button busy={busy} onClick={() => void act("reopen")}>
                  Reopen
                </Button>
              </>
            ) : detail.legal ? (
              <>
                <Button disabled={busy} onClick={() => void act("close")}>
                  Close without action
                </Button>
                {detail.reports.some((report) => report.status === "open") ? (
                  <Button disabled={busy} onClick={() => void act("ack")}>
                    Acknowledge
                  </Button>
                ) : null}
                <span className="adm-k-sp" />
                {access.decide && detail.adStatus === "active" ? (
                  <Button kind="danger" icon={Trash2} onClick={() => setRemoving({ ban: false })}>
                    Remove ad...
                  </Button>
                ) : null}
              </>
            ) : (
              <>
                <Button disabled={busy} onClick={() => void act("dismiss")}>
                  Dismiss
                </Button>
                <span className="adm-k-sp" />
                {more.length ? <MoreMenu items={more} placement="up" /> : null}
                {access.decide && detail.adStatus === "active" ? (
                  <Button kind="danger" icon={Trash2} onClick={() => setRemoving({ ban: false })}>
                    Remove ad...
                  </Button>
                ) : null}
              </>
            )
          }
        >
          <div className="adm-rp-pane" data-tk="report-drawer">
            <dl className="adm-rp-kvs">
              <div>
                <dt>Seller</dt>
                <dd>{`${detail.seller} · ${detail.sellerAds} ${detail.sellerAds === 1 ? "ad" : "ads"}`}</dd>
              </div>
              <div>
                <dt>Ad</dt>
                <dd>{[detail.adStatus === "active" ? "Live" : detail.adStatus, detail.paidCredits ? `paid ${detail.paidCredits} credits` : "free"].join(" · ")}</dd>
              </div>
              {detail.liveSince ? (
                <div>
                  <dt>Live since</dt>
                  <dd>{new Date(detail.liveSince).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })}</dd>
                </div>
              ) : null}
              <div>
                <dt>Earlier reports</dt>
                <dd>{detail.earlier ? `${detail.earlier} closed` : "None"}</dd>
              </div>
            </dl>
            {detail.reports.map((report) => (
              <div key={report.id} className="adm-rp-card">
                <strong>{report.reason}</strong>
                <span>{report.details ? `"${report.details}"` : "No comment"}</span>
                <small>{ago(report.since)} ago</small>
              </div>
            ))}
            {closedRow ? null : (
              <label className="adm-rp-note">
                <strong>Note (saved with the decision)</strong>
                <textarea className="adm-k-input" rows={3} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
              </label>
            )}
            {detail.legal ? <p className="adm-rp-help">Legal takedown records can be reopened, never deleted.</p> : null}
          </div>
        </Drawer>
      ) : null}
      <ReasonDialog
        key={removing ? (removing.ban ? "ban" : "remove") : "closed"}
        open={removing !== null && detail !== null}
        title={removing?.ban ? "Remove this ad and ban the seller?" : "Remove this ad?"}
        body={
          removing?.ban
            ? "The ad comes down at once, the seller is banned and their other live ads are paused. You can undo this for 7 days."
            : "The ad comes down at once and the reports are closed. You can undo this for 7 days."
        }
        paidAd={detail && detail.paidCredits > 0 ? { name: detail.seller, credits: detail.paidCredits } : undefined}
        danger
        confirmLabel={removing?.ban ? "Remove ad and ban seller" : "Remove ad"}
        onConfirm={(result) => {
          const ban = removing?.ban === true;
          setRemoving(null);
          void act(ban ? "removeBan" : "remove", result.giveBack);
        }}
        onCancel={() => setRemoving(null)}
      />
      <TakedownDialog
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={() => {
          setAdding(false);
          toast.show({ kind: "success", message: "Takedown added to the list." });
          router.refresh();
        }}
      />
    </div>
  );
}

/** The Reports screen: Open, Legal takedown and Closed, with a drawer that holds the reports and the decision. Everything you pick lives in the address. */
export function ReportsView(props: { list: ReportList; detail: ReportDetail | null; access: Access }) {
  return (
    <ToastProvider>
      <Screen {...props} />
    </ToastProvider>
  );
}
