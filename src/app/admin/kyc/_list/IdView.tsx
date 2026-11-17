"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, History, Undo2, X } from "lucide-react";
import { Badge, Button, Drawer, EmptyState, FilterBar, PageHeader, ReasonDialog, ServerTable, Tabs, ToastProvider, useToast, type BadgeTone, type TableColumn } from "@/components/admin/ui";
import type { IdDetail, IdList, IdRow, IdTab } from "@/server/verification/service";
import { decideIdAction, reopenIdAction, undoIdAction } from "../_actions/actions";
import "./id.css";

const TAB_LABELS: Record<IdTab, string> = { waiting: "Waiting", approved: "Approved", rejected: "Rejected" };
const TABS = Object.keys(TAB_LABELS) as IdTab[];
const SEARCH_DEBOUNCE_MS = 350;
const REASONS = ["Photo blurry", "Face does not match", "ID expired", "Under 18"] as const;
const APPROVE_REASON = "Document matches";
const MIN_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const LOOK: Record<string, { tone: BadgeTone; text: string }> = {
  pending_review: { tone: "warn", text: "Waiting" },
  approved: { tone: "ok", text: "Approved" },
  rejected: { tone: "bad", text: "Rejected" },
};

function ago(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < MIN_PER_HOUR) return `${minutes} min`;
  const hours = Math.floor(minutes / MIN_PER_HOUR);
  if (hours < HOURS_PER_DAY) return `${hours} h ${minutes % MIN_PER_HOUR} min`;
  return `${Math.floor(hours / HOURS_PER_DAY)} d`;
}

function IdPhoto({ label, src }: { label: string; src: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <span className="adm-id-none adm-id-gone" role="img" aria-label={`${label}: photo not available`} data-tk="id-photo-missing">
        Photo not available
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={(node) => {
        if (node && node.complete && node.naturalWidth === 0) setBroken(true);
      }}
      src={src}
      alt={label}
      onError={() => setBroken(true)}
    />
  );
}

function Screen({ list, detail }: { list: IdList; detail: IdDetail | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const { tab } = list.query;
  const [search, setSearch] = useState(list.query.q);
  const sentSearch = useRef(list.query.q);
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);

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

  async function undo(eventId: string) {
    const answer = await undoIdAction(eventId);
    toast.show({ kind: answer.ok ? "success" : "error", message: answer.message });
    router.refresh();
  }

  async function decide(decision: "approved" | "rejected", reason: string) {
    if (!detail) return;
    setBusy(true);
    const answer = await decideIdAction({ id: detail.id, decision, reason });
    setBusy(false);
    if (!answer.ok) {
      toast.show({ kind: "error", message: answer.message });
      return;
    }
    toast.show({ kind: "undo", message: `${detail.name} ${decision === "approved" ? "approved. The verified badge is on" : "rejected. The seller is told"}.`, onUndo: () => void undo(answer.eventId) });
    go({ open: null });
    router.refresh();
  }

  async function reopen(id: string) {
    setBusy(true);
    const answer = await reopenIdAction(id);
    setBusy(false);
    toast.show({ kind: answer.ok ? "success" : "error", message: answer.message });
    if (answer.ok) go({ open: null });
    router.refresh();
  }

  const columns: TableColumn<IdRow>[] = [
    {
      key: "person",
      header: "Person",
      primary: true,
      cell: (row) => (
        <>
          <strong>{row.name}</strong>
          <small>{row.reason && tab !== "waiting" ? row.reason : row.email}</small>
        </>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => {
        const look = LOOK[row.status] ?? { tone: "neutral" as BadgeTone, text: row.status };
        return <Badge tone={look.tone}>{look.text}</Badge>;
      },
    },
    {
      key: "wait",
      header: tab === "waiting" ? "Waiting" : "Decided",
      nowrap: true,
      cell: (row) => <span title={new Date(row.decidedAt ?? row.since).toLocaleString("en-IN")}>{ago(row.decidedAt ?? row.since)}{tab === "waiting" ? "" : " ago"}</span>,
    },
  ];

  const searching = list.query.q !== "";
  return (
    <div className="adm-k" data-tk="id-screen">
      <PageHeader
        crumbs={[{ label: "Queues" }]}
        title="ID checks"
        purpose="Compare the selfie with the ID. Approving gives the seller the verified badge on every ad."
        secondary={[{ key: "history", label: "History", icon: History, href: "/admin/history/" }]}
      />
      <div className="adm-card" style={{ padding: 0, overflow: "clip", marginBottom: 16 }}>
        <Tabs
          idPrefix="id"
          label="ID checks"
          active={tab}
          items={TABS.map((key) => ({ key, label: TAB_LABELS[key], count: list.counts[key] }))}
          onChange={(key) => go({ tab: key === "waiting" ? null : key, page: null, open: null, q: null })}
        />
        <div role="tabpanel" id={`id-panel-${tab}`} aria-labelledby={`id-${tab}`}>
          <FilterBar search={search} onSearch={setSearch} searchLabel="Search ID checks" placeholder="Name or email" chips={[]} onRemoveChip={() => undefined} />
          <ServerTable
            label={TAB_LABELS[tab]}
            columns={columns}
            rows={list.rows}
            rowId={(row) => row.id}
            rowLabel={(row) => row.name}
            total={list.total}
            page={list.query.page}
            pageSize={list.query.pageSize}
            onPage={(page) => go({ page: page === 1 ? null : String(page), open: null })}
            onPageSize={(size) => go({ size: size === 25 ? null : String(size), page: null, open: null })}
            openId={detail?.id ?? null}
            onOpen={(row) => go({ open: row.id })}
            empty={
              <EmptyState
                title={searching ? `No ID checks match "${list.query.q}"` : tab === "waiting" ? "No ID checks waiting" : `Nothing ${tab} yet`}
                why={searching ? "Try the first letters of the name or the full email." : "New checks show up here as soon as a seller sends their ID."}
              />
            }
          />
        </div>
      </div>
      {detail ? (
        <Drawer
          open
          title={detail.name}
          subtitle={`${detail.ads} ${detail.ads === 1 ? "ad" : "ads"} · sent ${ago(detail.since)} ago`}
          size="lg"
          onClose={() => go({ open: null })}
          footer={
            detail.status === "pending_review" ? (
              <>
                <Button kind="danger" icon={X} disabled={busy} onClick={() => setRejecting(true)}>
                  Reject...
                </Button>
                <span className="adm-k-sp" />
                <Button kind="primary" icon={Check} busy={busy} onClick={() => void decide("approved", APPROVE_REASON)}>
                  Approve
                </Button>
              </>
            ) : (
              <>
                <span className="adm-k-sp" />
                <Button icon={Undo2} busy={busy} disabled={!detail.canReopen} onClick={() => void reopen(detail.id)}>
                  Reopen
                </Button>
              </>
            )
          }
        >
          <div className="adm-id-pane" data-tk="id-drawer">
            <div className="adm-id-photos">
              {(
                [
                  ["Selfie", detail.files?.selfie],
                  ["ID front", detail.files?.front],
                  ["ID back", detail.files?.back],
                ] as const
              ).map(([label, src]) => (
                <figure key={label}>
                  {src ? (
                    <IdPhoto key={src} label={label} src={src} />
                  ) : (
                    <span className="adm-id-none" role="img" aria-label={`${label} not sent`} />
                  )}
                  <figcaption>{label}</figcaption>
                </figure>
              ))}
            </div>
            <dl className="adm-id-kvs">
              <div>
                <dt>Name on account</dt>
                <dd>{detail.name}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{detail.email}</dd>
              </div>
              <div>
                <dt>Age on ID</dt>
                <dd>
                  {detail.ageOnId === null ? "unknown" : detail.ageOnId}
                  {detail.ageOnId !== null ? <Badge tone={detail.adult ? "ok" : "bad"}>{detail.adult ? "18+" : "Under 18"}</Badge> : null}
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <Badge tone={(LOOK[detail.status] ?? LOOK.pending_review).tone}>{(LOOK[detail.status] ?? LOOK.pending_review).text}</Badge>
                  {detail.reason && detail.status !== "pending_review" ? <span>{detail.reason}</span> : null}
                </dd>
              </div>
            </dl>
            <p className="adm-id-help">Opening this check was written to the audit log. The ID number is never shown here.</p>
            {detail.status !== "pending_review" ? <p className="adm-id-help">A decision can be reopened for 7 days. The verified badge is off until it is decided again.</p> : null}
          </div>
        </Drawer>
      ) : null}
      <ReasonDialog
        key={rejecting ? "open" : "closed"}
        open={rejecting && detail !== null}
        title="Reject this ID check?"
        body="The seller is told and does not get the verified badge. You can reopen this for 7 days."
        reasons={REASONS}
        requireReason
        textLabel="Add a note (optional)"
        danger
        confirmLabel="Reject ID check"
        onConfirm={(result) => {
          setRejecting(false);
          void decide("rejected", [result.reason, result.text].filter(Boolean).join(": "));
        }}
        onCancel={() => setRejecting(false)}
      />
    </div>
  );
}

/** The ID checks screen: Waiting, Approved and Rejected, a drawer with the three photos, Approve, Reject and Reopen. Everything you pick lives in the address. */
export function IdView(props: { list: IdList; detail: IdDetail | null }) {
  return (
    <ToastProvider>
      <Screen {...props} />
    </ToastProvider>
  );
}
