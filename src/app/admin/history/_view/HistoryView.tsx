"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, SearchX, Undo2 } from "lucide-react";
import { undoAction } from "@/app/admin/undo-actions";
import { Badge, Button, FilterBar, LockBadge, PageHeader, ServerTable, Tabs, ToastProvider, useToast, type TableColumn } from "@/components/admin/ui";
import { HISTORY_DAYS, TYPE_LABELS, type TypeKey } from "@/server/admin/history-rules";
import type { HistoryDetail, HistoryList, HistoryRow } from "@/server/admin/history";
import { doneWords, STATE_BADGE, whenLabel, whoLine } from "./format";
import { RowDrawer } from "./RowDrawer";
import "./history.css";

const SEARCH_DEBOUNCE_MS = 350;
const DAYS_LABEL: Record<number, string> = { 7: "Last 7 days", 30: "Last 30 days", 90: "Last 90 days", 0: "All time" };

export type Windows = { key: string; days: number; text: string }[];

function Screen({ list, detail, windows }: { list: HistoryList; detail: HistoryDetail | null; windows: Windows }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const [search, setSearch] = useState(list.query.q);
  const sent = useRef(list.query.q);
  const [busy, setBusy] = useState(false);
  const audit = list.query.tab === "audit";

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
      go({ q: search.trim() || null, page: null, open: null });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function undo(actionId: string, label: string) {
    if (busy) return;
    setBusy(true);
    const outcome = await undoAction(actionId);
    setBusy(false);
    if (!outcome.ok) {
      toast.show({ kind: "error", message: outcome.message });
      return;
    }
    const again = outcome.eventId;
    toast.show({
      kind: "undo",
      message: doneWords(label),
      onUndo: async () => {
        const back = await undoAction(again);
        toast.show(back.ok ? { kind: "success", message: "Changed back." } : { kind: "error", message: back.message });
        router.refresh();
      },
    });
    go({ open: null });
    router.refresh();
  }

  const now = new Date();
  const columns: TableColumn<HistoryRow>[] = [
    {
      key: "change",
      header: "Change",
      primary: true,
      cell: (row) => (
        <>
          <strong>{row.title}</strong>
          {row.label ? <small>{row.label}</small> : null}
          <small>{whoLine(row.who, row.role)}</small>
        </>
      ),
    },
    {
      key: "state",
      header: "Undo",
      cell: (row) => {
        const badge = STATE_BADGE[row.state];
        return row.lock ? <Badge tone="bad">{row.lock.text}</Badge> : badge ? <Badge tone={badge.tone}>{badge.text}</Badge> : <span className="adm-h-undone">-</span>;
      },
    },
    { key: "time", header: "Time", nowrap: true, cell: (row) => <span title={row.at}>{whenLabel(row.at, now)}</span> },
  ];

  const filtersOn = list.query.who !== "" || list.query.type !== "" || list.query.mine || list.query.q !== "";
  const chips = [
    ...(list.query.mine ? [{ key: "mine", label: "Only what I can undo" }] : []),
    ...(list.query.who ? [{ key: "who", label: "Who", value: list.actors.find((actor) => actor.id === list.query.who)?.name ?? "Someone" }] : []),
    ...(list.query.type ? [{ key: "type", label: "Type", value: TYPE_LABELS[list.query.type as TypeKey] }] : []),
    { key: "days", label: DAYS_LABEL[list.query.days] },
  ];

  return (
    <div className="adm-k" data-tk="history-screen">
      <PageHeader
        crumbs={[{ label: "Today" }]}
        title="History & undo"
        purpose="Every change by staff, newest first. Undo puts things back and is logged too."
        secondary={[{ key: "export", label: "Export", icon: Download, href: `/admin/history/export/${params.toString() ? `?${params.toString()}` : ""}` }]}
      />
      <div className="adm-card adm-h-flat">
        <Tabs
          idPrefix="history"
          label="History"
          active={list.query.tab}
          items={[{ key: "recent", label: "Recent changes" }, ...(list.canSeeAudit ? [{ key: "audit", label: "Full audit log" }] : [])]}
          onChange={(key) => go({ tab: key === "recent" ? null : key, page: null, open: null, mine: null })}
        />
        <div role="tabpanel" id={`history-panel-${list.query.tab}`} aria-labelledby={`history-${list.query.tab}`}>
          <FilterBar
            search={search}
            onSearch={setSearch}
            searchLabel="Search changes"
            placeholder="Ad, user, page or setting"
            chips={chips}
            onRemoveChip={(key) => go(key === "days" ? { days: "0", page: null } : { [key]: null, page: null })}
          />
          <div className="adm-h-filters" data-tk="history-filters">
            <label>
              Who
              <select value={list.query.who} onChange={(event) => go({ who: event.target.value || null, page: null, open: null })}>
                <option value="">Everyone</option>
                {list.actors.map((actor) => (
                  <option key={actor.id} value={actor.id}>{actor.name}</option>
                ))}
              </select>
            </label>
            <label>
              Type
              <select value={list.query.type} onChange={(event) => go({ type: event.target.value || null, page: null, open: null })}>
                <option value="">All types</option>
                {(Object.keys(TYPE_LABELS) as TypeKey[]).map((key) => (
                  <option key={key} value={key}>{TYPE_LABELS[key]}</option>
                ))}
              </select>
            </label>
            <label>
              When
              <select value={String(list.query.days)} onChange={(event) => go({ days: event.target.value === "7" ? null : event.target.value, page: null, open: null })}>
                {HISTORY_DAYS.map((days) => (
                  <option key={days} value={days}>{DAYS_LABEL[days]}</option>
                ))}
              </select>
            </label>
            {audit ? null : (
              <Button kind={list.query.mine ? "primary" : "secondary"} onClick={() => go({ mine: list.query.mine ? null : "1", page: null, open: null })}>
                {list.query.mine ? "Showing only what I can undo" : "Only what I can undo"}
              </Button>
            )}
          </div>
          <ServerTable
            label={audit ? "Full audit log" : "Recent changes"}
            columns={columns}
            rows={list.rows}
            rowId={(row) => row.id}
            rowLabel={(row) => row.title}
            total={list.total}
            page={list.query.page}
            pageSize={list.query.pageSize}
            onPage={(page) => go({ page: page === 1 ? null : String(page), open: null })}
            onPageSize={(size) => go({ size: size === 25 ? null : String(size), page: null, open: null })}
            openId={detail?.row.id ?? null}
            onOpen={(row) => go({ open: row.id })}
            rowActions={(row) =>
              row.actionId && row.actionLabel ? (
                <Button size="sm" icon={Undo2} disabled={busy} onClick={() => void undo(row.actionId as string, row.actionLabel as string)}>
                  {row.actionLabel}
                </Button>
              ) : row.lock ? (
                <LockBadge reason="Never" />
              ) : null
            }
            empty={
              <div className="adm-h-state" data-tk="history-empty">
                <SearchX aria-hidden="true" />
                <h3>{filtersOn ? "No changes match" : "No changes yet"}</h3>
                <p>{filtersOn ? "Try another filter, or look at all time." : "Changes by staff show here as soon as someone makes one."}</p>
                {filtersOn ? <Button onClick={() => { setSearch(""); sent.current = ""; go({ q: null, who: null, type: null, mine: null, days: "0", page: null }); }}>Clear filters</Button> : null}
              </div>
            }
          />
        </div>
      </div>

      <section className="adm-card adm-h-flat" aria-labelledby="what-undone" data-tk="what-can-be-undone">
        <header style={{ padding: "14px 20px" }}>
          <h2 id="what-undone" style={{ fontSize: 15, fontWeight: 800 }}>What can be undone</h2>
        </header>
        <ul className="adm-h-rules">
          {windows.map((item) => (
            <li key={item.key}>
              <Badge tone={item.days >= 30 ? "ok" : "warn"}>{item.days} days</Badge>
              <span>{item.text}</span>
            </li>
          ))}
          <li>
            <Badge tone="bad">Never</Badge>
            <span>Payments, refunds and payouts sent, emails already sent, pictures deleted from Trash and legal takedown records.</span>
          </li>
        </ul>
      </section>

      <RowDrawer detail={detail} busy={busy} onClose={() => go({ open: null })} onUndo={(id, label) => void undo(id, label)} />
    </div>
  );
}

export function HistoryView(props: { list: HistoryList; detail: HistoryDetail | null; windows: Windows }) {
  return (
    <ToastProvider>
      <Screen {...props} />
    </ToastProvider>
  );
}
