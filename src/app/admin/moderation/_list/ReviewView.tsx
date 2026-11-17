"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, History, List, X } from "lucide-react";
import { Badge, Button, DiffView, Drawer, EmptyState, FilterBar, Notice, PageHeader, ReasonDialog, ServerTable, Tabs, ToastProvider, useToast, type BadgeTone, type TableColumn } from "@/components/admin/ui";
import type { ReviewDetail, ReviewList, ReviewRow, ReviewTab } from "@/server/moderation/review";
import { approveAction } from "../actions";
import { rejectAdAction, removeAdAction, undoDecisionAction } from "../_actions/actions";
import { markCheckedAction } from "./actions";
import "./review.css";

const TAB_LABELS: Record<ReviewTab, string> = { live: "Live, not checked", held: "Held by rules", edited: "Edited, photos waiting" };
const TABS = Object.keys(TAB_LABELS) as ReviewTab[];
const SEARCH_DEBOUNCE_MS = 350;
const REASONS = ["Breaks the posting rules", "Photos do not match the text", "Spam or a duplicate ad", "The seller asked us to"] as const;

type Deciding = { kind: "reject" | "remove"; id: string; title: string; seller: string; paidCredits: number };
const MIN_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

function waited(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < MIN_PER_HOUR) return `${minutes} min`;
  const hours = Math.floor(minutes / MIN_PER_HOUR);
  if (hours < HOURS_PER_DAY) return `${hours} h ${minutes % MIN_PER_HOUR} min`;
  return `${Math.floor(hours / HOURS_PER_DAY)} d`;
}

const FLAG_TONE: Record<string, BadgeTone> = { "Banned word": "bad", "Phone in text": "warn" };

function when(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
}

function Flags({ flags, paid }: { flags: string[]; paid: boolean }) {
  if (!flags.length && !paid) return <Badge>No flags</Badge>;
  return (
    <span className="adm-r-flags">
      {flags.map((flag) => (
        <Badge key={flag} tone={FLAG_TONE[flag] ?? "warn"}>
          {flag}
        </Badge>
      ))}
      {paid ? <Badge tone="pri">Paid</Badge> : null}
    </span>
  );
}

function Screen({ list, detail, canSettings }: { list: ReviewList; detail: ReviewDetail | null; canSettings: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const { tab } = list.query;
  const [search, setSearch] = useState(list.query.q);
  const sentSearch = useRef(list.query.q);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [deciding, setDeciding] = useState<Deciding | null>(null);

  function go(changes: Record<string, string | null>) {
    if (!("open" in changes && Object.keys(changes).length === 1)) setSelected([]);
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

  async function approve(ids: string[]) {
    setBusy(true);
    let failed = "";
    for (const id of ids) {
      const result = tab === "held" ? await approveAction(id) : await markCheckedAction(id);
      if (!result.ok) failed = "error" in result ? result.error : result.message;
    }
    setBusy(false);
    setSelected([]);
    if (failed) toast.show({ kind: "error", message: failed });
    else toast.show({ kind: "success", message: ids.length === 1 ? (tab === "held" ? "Ad approved and live." : "Ad approved.") : `${ids.length} ads approved.` });
    router.refresh();
  }

  function decide(kind: "reject" | "remove", id: string) {
    const row = list.rows.find((item) => item.id === id);
    const title = row?.title ?? detail?.title ?? "";
    setDeciding({ kind, id, title, seller: row?.seller ?? detail?.seller ?? "", paidCredits: row?.paidCredits ?? detail?.paidCredits ?? 0 });
  }

  async function undo(eventId: string) {
    const answer = await undoDecisionAction(eventId);
    toast.show({ kind: answer.ok ? "success" : "error", message: answer.message });
    router.refresh();
  }

  async function confirmDecision(result: { reason: string; text: string; giveBack: boolean }) {
    const current = deciding;
    setDeciding(null);
    if (!current) return;
    const reason = [result.reason, result.text].filter(Boolean).join(": ");
    const run = current.kind === "reject" ? rejectAdAction : removeAdAction;
    const answer = await run({ id: current.id, reason, refund: result.giveBack });
    if (!answer.ok) toast.show({ kind: "error", message: answer.message });
    else {
      const what = current.kind === "reject" ? "rejected. The seller is told" : "removed";
      const money = answer.refunded > 0 ? ` ${answer.refunded} credits given back.` : "";
      toast.show({ kind: "undo", message: `"${current.title}" ${what}.${money}`, onUndo: () => void undo(answer.eventId) });
    }
    router.refresh();
  }

  const actionable = tab !== "edited";
  const approveLabel = "Approve";
  const columns: TableColumn<ReviewRow>[] = [
    {
      key: "ad",
      header: "Ad",
      primary: true,
      cell: (row) => (
        <span className="adm-r-main">
          {row.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="adm-r-thumb" src={row.thumb} alt="" width={40} height={40} />
          ) : (
            <span className="adm-r-thumb" aria-hidden="true" />
          )}
          <span className="adm-r-text">
            <strong>{row.title || "(no title)"}</strong>
            <small>{[row.category, row.city].filter(Boolean).join(" · ")}</small>
          </span>
        </span>
      ),
    },
    { key: "flags", header: "Flags", cell: (row) => <Flags flags={row.flags} paid={row.paid} /> },
    { key: "seller", header: "Seller", hideOnPhone: true, cell: (row) => row.seller || "unknown" },
    { key: "wait", header: "Waiting", nowrap: true, cell: (row) => <span title={new Date(row.since).toLocaleString("en-IN")}>{waited(row.since)}</span> },
  ];

  const searching = list.query.q !== "";
  return (
    <div className="adm-k" data-tk="review-screen">
      <PageHeader
        crumbs={[{ label: "Queues" }]}
        title="Ads to review"
        purpose="Ads go live at once. Check them here, oldest first. Approve keeps an ad live."
        secondary={[
          { key: "history", label: "History", icon: History, href: "/admin/history/" },
          { key: "all-ads", label: "Open all ads", icon: List, href: "/admin/ads/" },
        ]}
      />
      <div className="adm-card" style={{ padding: 0, overflow: "clip", marginBottom: 16 }}>
        <Tabs
          idPrefix="review"
          label="Ads to review"
          active={tab}
          items={TABS.map((key) => ({ key, label: TAB_LABELS[key], count: list.counts[key] }))}
          onChange={(key) => go({ tab: key === "live" ? null : key, page: null, open: null, q: null })}
        />
        <div role="tabpanel" id={`review-panel-${tab}`} aria-labelledby={`review-${tab}`}>
          <FilterBar search={search} onSearch={setSearch} searchLabel="Search ads" placeholder="Title" chips={[]} onRemoveChip={() => undefined} />
          <ServerTable
            label={TAB_LABELS[tab]}
            columns={columns}
            rows={list.rows}
            rowId={(row) => row.id}
            rowLabel={(row) => row.title || "ad"}
            total={list.total}
            page={list.query.page}
            pageSize={list.query.pageSize}
            onPage={(page) => go({ page: page === 1 ? null : String(page), open: null })}
            onPageSize={(size) => go({ size: size === 25 ? null : String(size), page: null, open: null })}
            selectable={actionable}
            selected={selected}
            onSelected={setSelected}
            bulkActions={
              <Button icon={Check} busy={busy} onClick={() => void approve(selected)}>
                {approveLabel}
              </Button>
            }
            openId={detail?.id ?? null}
            onOpen={(row) => go({ open: row.id })}
            rowActions={
              actionable
                ? (row) => (
                    <>
                      <Button icon={Check} disabled={busy} onClick={() => void approve([row.id])}>
                        {approveLabel}
                      </Button>
                      <Button kind="danger" icon={X} onClick={() => decide(tab === "held" ? "reject" : "remove", row.id)}>
                        {tab === "held" ? "Reject..." : "Remove ad..."}
                      </Button>
                    </>
                  )
                : undefined
            }
            empty={
              tab === "live" && !list.liveCheckOn && !searching ? (
                <EmptyState
                  title="The check after going live is off"
                  why="Ads go live without a check, so none wait here. Turn on Check ads after they go live under Posting rules in Settings."
                  action={canSettings ? { label: "Open Posting rules", href: "/admin/settings/#posting" } : undefined}
                />
              ) : (
                <EmptyState
                  title={searching ? `No ads match "${list.query.q}"` : "No ads waiting"}
                  why={searching ? "Try the first letters of the title." : tab === "live" && list.counts.live === 0 ? "Nothing live is waiting for a check." : "Everything in this list has been looked at."}
                />
              )
            }
          />
        </div>
      </div>
      {detail ? (
        <Drawer
          open
          title={detail.title || "(no title)"}
          subtitle={[detail.category, detail.city, detail.seller].filter(Boolean).join(" · ")}
          onClose={() => go({ open: null })}
          footer={
            tab === "edited" ? undefined : (
              <>
                <Button kind="danger" icon={X} onClick={() => decide(tab === "held" ? "reject" : "remove", detail.id)}>
                  {tab === "held" ? "Reject..." : "Remove ad..."}
                </Button>
                <span className="adm-k-sp" />
                <Button kind="primary" icon={Check} busy={busy} onClick={() => void approve([detail.id])}>
                  {approveLabel}
                </Button>
              </>
            )
          }
        >
          <div className="adm-r-pane" data-tk="review-drawer">
            {detail.photos.length ? (
              <div className="adm-r-photos" data-n={Math.min(detail.photos.length, 3)}>
                {detail.photos.map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={src} src={src} alt="" />
                ))}
              </div>
            ) : null}
            <div className="adm-r-flags">
              <Badge tone={detail.status === "active" ? "ok" : "warn"}>{detail.status === "active" ? `Live since ${waited(detail.since)}` : "In review"}</Badge>
              {detail.flags.map((flag) => (
                <Badge key={flag} tone={FLAG_TONE[flag] ?? "warn"}>
                  {flag}
                </Badge>
              ))}
              {detail.paid ? <Badge tone="pri">{`Paid ${detail.paidCredits} credits`}</Badge> : null}
            </div>
            <p className="adm-r-text-body">{detail.description}</p>
            <dl className="adm-r-kvs">
              <div>
                <dt>Seller</dt>
                <dd>{[detail.seller || "unknown", `${detail.sellerAds} ${detail.sellerAds === 1 ? "ad" : "ads"}`, detail.sellerJoined ? `joined ${new Date(detail.sellerJoined).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}` : ""].filter(Boolean).join(" · ")}</dd>
              </div>
              <div>
                <dt>ID check</dt>
                <dd>{detail.idCheck}</dd>
              </div>
              <div>
                <dt>Paid</dt>
                <dd>{detail.paid ? `${detail.paidCredits} credits${detail.paidAt ? ` · ${when(detail.paidAt)}` : ""}` : "Free ad"}</dd>
              </div>
              <div>
                <dt>Posted from</dt>
                <dd>{detail.city || "unknown"}</dd>
              </div>
            </dl>
            {detail.paid && tab !== "edited" ? (
              <Notice kind="info">
                {tab === "held" ? "Reject" : "Remove"} takes the ad down and tells the seller. Because this ad is paid, you choose on the next step whether to give back the {detail.paidCredits} credits.
              </Notice>
            ) : null}
            {detail.changes.length ? (
              <>
                <h3 className="adm-r-h3">Changed since the last approved version</h3>
                <DiffView rows={detail.changes.map((change) => ({ path: change.field, kind: "changed", before: change.before, after: change.after }))} />
              </>
            ) : null}
          </div>
        </Drawer>
      ) : null}
      <ReasonDialog
        key={deciding ? `${deciding.kind}-${deciding.id}` : "closed"}
        open={deciding !== null}
        title={deciding?.kind === "reject" ? "Reject this ad?" : "Remove this ad?"}
        body={
          deciding?.kind === "reject"
            ? "The ad is turned down and the seller is told. You can undo this for 7 days."
            : "The ad comes down at once and the seller is told. You can undo this for 7 days."
        }
        reasons={REASONS}
        requireReason
        textLabel="Add a note for the seller (optional)"
        paidAd={deciding && deciding.paidCredits > 0 ? { name: deciding.seller || "the seller", credits: deciding.paidCredits } : undefined}
        danger
        confirmLabel={deciding?.kind === "reject" ? "Reject ad" : "Remove ad"}
        onConfirm={(result) => void confirmDecision(result)}
        onCancel={() => setDeciding(null)}
      />
    </div>
  );
}

/** The Ads to review screen: three tabs, search, a table with Approve, and a preview drawer. Everything you pick lives in the address. */
export function ReviewView({ list, detail, canSettings }: { list: ReviewList; detail: ReviewDetail | null; canSettings: boolean }) {
  return (
    <ToastProvider>
      <Screen list={list} detail={detail} canSettings={canSettings} />
    </ToastProvider>
  );
}
