"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarClock, CalendarPlus, FolderInput, ImageOff, Pause, Play, Plus, Trash2 } from "lucide-react";
import { SearchX } from "lucide-react";
import { Badge, Button, FilterBar, PageHeader, ReasonDialog, ServerTable, Tabs, ToastProvider, useToast, type BadgeTone, type FilterChip, type TableColumn } from "@/components/admin/ui";
import type { AdRow, AdsList, AdsSort, AdsTab } from "@/server/admin/ads-list";
import { BULK_TYPED_FROM, EXTEND_CHOICES, extendWord } from "@/lib/admin/ads-bulk-rules";
import { endsIn, istDateTime, istInputToIso, istInputValue } from "@/lib/admin/ad-ends";
import { undoAction } from "@/app/admin/undo-actions";
import { bulkAdsAction, undoAdsBatchAction } from "../_actions/actions";
import { MoveDialog } from "./MoveDialog";
import "./ads.css";

export type AdsAccess = { edit: boolean; decide: boolean; create: boolean; pins: boolean };

const TAB_LABELS: Record<AdsTab, string> = { all: "All", live: "Live", review: "In review", paused: "Paused", removed: "Removed", expired: "Expired", promoted: "Promoted", demo: "Demo ads" };
const TABS = Object.keys(TAB_LABELS) as AdsTab[];
const SEARCH_DEBOUNCE_MS = 350;
const REMOVE_REASONS = ["Breaks the posting rules", "Spam or a test ad", "Photos do not match the text", "The seller asked us to"] as const;
const STATUS_LOOK: Record<string, { tone: BadgeTone; text: string }> = {
  active: { tone: "ok", text: "Live" },
  pending: { tone: "info", text: "In review" },
  paused: { tone: "neutral", text: "Paused" },
  removed: { tone: "bad", text: "Removed" },
  rejected: { tone: "bad", text: "Rejected" },
  expired: { tone: "neutral", text: "Expired" },
  archived: { tone: "neutral", text: "Archived" },
};
const ADD_FILTERS = [
  { key: "junk", label: "Looks like junk" },
  { key: "pvideo", label: "People ads with a video" },
  { key: "cat", label: "Category" },
  { key: "city", label: "City" },
  { key: "paid", label: "Paid or free" },
  { key: "home", label: "On Home" },
  { key: "kind", label: "Real or demo" },
  { key: "ends", label: "Ends within 24 h" },
] as const;
const SORT_LABELS: Record<AdsSort, string> = { new: "Newest first", ends: "Ends soonest", ends_last: "Ends last" };
type FilterKey = (typeof ADD_FILTERS)[number]["key"];

function day(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}

function Ends({ row, now }: { row: AdRow; now: number }) {
  if (!row.expiresAt) return <span className="adm-ads-ends">No end time</span>;
  const gone = ["expired", "archived", "removed", "rejected"].includes(row.status);
  return (
    <span className="adm-ads-ends" data-tk="ad-ends">
      <span>{istDateTime(row.expiresAt)}</span>
      <small>{gone ? "ended" : endsIn(row.expiresAt, now)}</small>
    </span>
  );
}

function Status({ row }: { row: AdRow }) {
  const look = STATUS_LOOK[row.status] ?? { tone: "neutral" as BadgeTone, text: row.status };
  return (
    <span className="adm-ads-badges">
      <Badge tone={look.tone}>{look.text}</Badge>
      {row.paidCredits > 0 ? <Badge tone="pri">Paid</Badge> : <Badge>Free</Badge>}
      {row.promoted ? <Badge tone="pri">Promoted</Badge> : null}
      {row.demo ? <Badge tone="warn">Demo</Badge> : null}
      {row.homeSlot ? <Badge tone="info">{`Home slot ${row.homeSlot}`}</Badge> : null}
      {row.junk ? <Badge tone="warn">Looks like junk</Badge> : null}
    </span>
  );
}

function Screen({ list, access, demoPanel }: { list: AdsList; access: AdsAccess; demoPanel: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const { query } = list;
  const [search, setSearch] = useState(query.q);
  const sentSearch = useRef(query.q);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [adding, setAdding] = useState<FilterKey | null>(null);
  const [cityText, setCityText] = useState(query.city);
  const [now] = useState(() => Date.now());
  const [extending, setExtending] = useState(false);
  const [moving, setMoving] = useState(false);
  const [settingEnd, setSettingEnd] = useState(false);
  const [endValue, setEndValue] = useState("");
  const [endError, setEndError] = useState("");

  function go(changes: Record<string, string | null>) {
    setSelected([]);
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
      go({ q: search.trim() || null, page: null });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function undo(batchId: string, eventIds: string[]) {
    const answer = await undoAdsBatchAction({ batchId, eventIds });
    toast.show({ kind: answer.ok ? "success" : "error", message: answer.message });
    router.refresh();
  }

  async function undoMove(eventId: string) {
    const outcome = await undoAction(eventId);
    toast.show({ kind: outcome.ok ? "success" : "error", message: outcome.ok ? "Undone. The ads are back in their old category." : outcome.message });
    router.refresh();
  }

  async function run(action: "pause" | "resume" | "extend" | "setEnd" | "remove", extra: { reason?: string; confirm?: string; hours?: number; endsAt?: string } = {}) {
    const ids = selected;
    setBusy(true);
    const answer = await bulkAdsAction({ action, ids, ...extra });
    setBusy(false);
    if (!answer.ok) {
      toast.show({ kind: "error", message: answer.message });
      return;
    }
    setSelected([]);
    const verb = { pause: "Paused", resume: "Resumed", extend: extendWord(extra.hours ?? 720), setEnd: "End time set", remove: "Removed" }[action];
    const skipped = answer.skipped.length ? ` ${answer.skipped.length} skipped: ${answer.skipped[0].why.toLowerCase()}.` : "";
    if (answer.changed === 0) {
      toast.show({ kind: "error", message: `Nothing changed.${skipped}` });
    } else {
      toast.show({
        kind: "undo",
        message: `${verb}: ${answer.changed} ${answer.changed === 1 ? "ad" : "ads"}.${skipped}`,
        onUndo: () => void undo(answer.batchId, answer.eventIds),
      });
    }
    router.refresh();
  }

  const categoryName = list.categories.find((item) => item.id === query.category)?.name ?? "";
  const chips: FilterChip[] = [];
  if (query.junk) chips.push({ key: "junk", label: "Looks like junk" });
  if (query.peopleVideo) chips.push({ key: "pvideo", label: "People ads with a video" });
  if (query.category) chips.push({ key: "cat", label: "Category", value: categoryName || "unknown" });
  if (query.city) chips.push({ key: "city", label: "City", value: query.city });
  if (query.paid !== "all") chips.push({ key: "paid", label: "Paid or free", value: query.paid === "paid" ? "Paid" : "Free" });
  if (query.home) chips.push({ key: "home", label: "On Home" });
  if (query.kind !== "all") chips.push({ key: "kind", label: "Real or demo", value: query.kind === "demo" ? "Demo ads" : "Real ads" });
  if (query.endsSoon) chips.push({ key: "ends", label: "Ends within 24 h" });
  const addable = ADD_FILTERS.filter((item) => !chips.some((chip) => chip.key === item.key));

  function clearFilter(key: string) {
    setAdding(null);
    if (key === "city") setCityText("");
    go({ [key]: null, page: null });
  }

  function addFilter(key: string) {
    if (key === "junk" || key === "home" || key === "pvideo") go({ [key]: "1", page: null });
    else if (key === "ends") go({ ends: "24", page: null });
    else setAdding(key as FilterKey);
  }

  const columns: TableColumn<AdRow>[] = [
    {
      key: "ad",
      header: "Ad",
      primary: true,
      cell: (row) => (
        <span className="adm-ads-ad">
          {row.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="adm-ads-thumb" src={row.thumb} alt="" width={48} height={48} loading="lazy" data-tk="ad-thumb" />
          ) : (
            <span className="adm-ads-thumb adm-ads-nothumb" data-tk="ad-nothumb" aria-hidden="true"><ImageOff size={18} /></span>
          )}
          <span className="adm-ads-adtext">
            <strong>{row.title}</strong>
            <small>{[row.category, row.city].filter(Boolean).join(" · ")}</small>
          </span>
        </span>
      ),
    },
    { key: "status", header: "Status", cell: (row) => <Status row={row} /> },
    { key: "seller", header: "Seller", hideOnPhone: true, cell: (row) => row.seller || "unknown" },
    { key: "ends", header: "Ends", nowrap: true, cell: (row) => <Ends row={row} now={now} /> },
    { key: "posted", header: "Posted", nowrap: true, cell: (row) => <span title={new Date(row.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}>{day(row.createdAt)}</span> },
  ];

  const searching = query.q !== "" || chips.length > 0;
  const needsTyped = selected.length >= BULK_TYPED_FROM;
  return (
    <div className="adm-k" data-tk="ads-screen">
      <PageHeader
        crumbs={[{ label: "Ads & people" }]}
        title="All ads"
        purpose="Every ad in every state. Open one to edit it, or select several to pause, extend or remove."
        more={[
          ...(access.create ? [{ key: "import", label: "Import", href: "/admin/import/" }] : []),
          ...(access.pins ? [{ key: "pins", label: "Order and pins", href: "/admin/ads/home/" }] : []),
        ]}
        primary={access.create ? { key: "create", label: "Create ad", icon: Plus, href: "/admin/ads/create/", kind: "primary" } : undefined}
      />
      <div className="adm-card adm-ads-flat">
        <Tabs
          idPrefix="ads"
          label="All ads"
          active={query.tab}
          items={TABS.map((key) => ({ key, label: TAB_LABELS[key], count: list.counts[key] }))}
          onChange={(key) => go({ tab: key === "all" ? null : key, page: null })}
        />
        <div role="tabpanel" id={`ads-panel-${query.tab}`} aria-labelledby={`ads-${query.tab}`}>
          {query.tab === "demo" ? demoPanel : null}
          <FilterBar
            search={search}
            onSearch={setSearch}
            searchLabel="Search ads"
            placeholder="Title, ad ID, seller or phone"
            chips={chips}
            onRemoveChip={clearFilter}
            addable={addable.map((item) => ({ key: item.key, label: item.label }))}
            onAdd={addFilter}
          />
          {adding === "cat" ? (
            <label className="adm-ads-pick">
              Category
              <select autoFocus defaultValue="" onChange={(event) => { setAdding(null); go({ cat: event.target.value || null, page: null }); }}>
                <option value="">Choose a category</option>
                {list.categories.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
          ) : null}
          {adding === "paid" ? (
            <label className="adm-ads-pick">
              Paid or free
              <select autoFocus defaultValue="" onChange={(event) => { setAdding(null); go({ paid: event.target.value || null, page: null }); }}>
                <option value="">Choose</option>
                <option value="paid">Paid</option>
                <option value="free">Free</option>
              </select>
            </label>
          ) : null}
          {adding === "kind" ? (
            <label className="adm-ads-pick">
              Real or demo
              <select autoFocus defaultValue="" onChange={(event) => { setAdding(null); go({ kind: event.target.value || null, page: null }); }}>
                <option value="">Choose</option>
                <option value="real">Real ads only</option>
                <option value="demo">Demo ads only</option>
              </select>
            </label>
          ) : null}
          {adding === "city" ? (
            <form
              className="adm-ads-pick"
              onSubmit={(event) => {
                event.preventDefault();
                setAdding(null);
                go({ city: cityText.trim() || null, page: null });
              }}
            >
              <label>
                City name
                <input autoFocus value={cityText} onChange={(event) => setCityText(event.target.value)} placeholder="First letters of the city" />
              </label>
              <Button type="submit">Apply</Button>
            </form>
          ) : null}
          <label className="adm-ads-pick adm-ads-sort">
            Sort by
            <select value={query.sort} data-tk="ads-sort" onChange={(event) => go({ sort: event.target.value === "new" ? null : event.target.value, page: null })}>
              {(Object.keys(SORT_LABELS) as AdsSort[]).map((key) => (
                <option key={key} value={key}>{SORT_LABELS[key]}</option>
              ))}
            </select>
          </label>
          <ServerTable
            label={`${TAB_LABELS[query.tab]} ads`}
            columns={columns}
            rows={list.rows}
            rowId={(row) => row.id}
            rowLabel={(row) => row.title}
            total={list.total}
            page={query.page}
            pageSize={query.pageSize}
            onPage={(page) => go({ page: page === 1 ? null : String(page) })}
            onPageSize={(size) => go({ size: size === 25 ? null : String(size), page: null })}
            selectable={access.edit || access.decide}
            selected={selected}
            onSelected={setSelected}
            bulkActions={
              <>
                {access.edit ? (
                  <>
                    <Button icon={Pause} busy={busy} onClick={() => void run("pause")}>Pause</Button>
                    <Button icon={Play} busy={busy} onClick={() => void run("resume")}>Resume</Button>
                    <Button icon={CalendarPlus} busy={busy} onClick={() => setExtending(true)}>Extend...</Button>
                    <Button icon={CalendarClock} busy={busy} onClick={() => { setEndValue(""); setEndError(""); setSettingEnd(true); }}>Set end...</Button>
                    <Button icon={FolderInput} busy={busy} onClick={() => setMoving(true)}>Move to category...</Button>
                  </>
                ) : null}
                {access.decide ? (
                  <Button kind="danger" icon={Trash2} busy={busy} onClick={() => setRemoving(true)}>Remove...</Button>
                ) : null}
              </>
            }
            onOpen={(row) => router.push(`/admin/ads/${row.id}/`)}
            rowActions={(row) => (
              <Button href={`/admin/ads/${row.id}/`} className="adm-ads-edit">Edit</Button>
            )}
            empty={
              <div className="adm-ads-state" data-tk="ads-empty">
                <span className="adm-ads-state-icon" aria-hidden="true"><SearchX /></span>
                <h3>{searching ? "No ads match" : `No ${TAB_LABELS[query.tab].toLowerCase()} ads`}</h3>
                <p>{searching ? "Try fewer filters, or search by a different word or by the ad ID." : "Ads appear here as soon as they are posted."}</p>
                {searching ? (
                  <Button
                    onClick={() => {
                      setSearch("");
                      sentSearch.current = "";
                      setCityText("");
                      go({ q: null, junk: null, pvideo: null, cat: null, city: null, paid: null, home: null, kind: null, page: null });
                    }}
                  >
                    Clear search and filters
                  </Button>
                ) : null}
              </div>
            }
          />
        </div>
      </div>
      <MoveDialog
        key={moving ? "move-open" : "move-closed"}
        open={moving}
        categories={list.categories}
        selected={selected}
        matching={list.total}
        search={params.toString()}
        onClose={() => setMoving(false)}
        onMoved={(answer) => {
          setSelected([]);
          const there = answer.alreadyThere ? ` ${answer.alreadyThere} ${answer.alreadyThere === 1 ? "was" : "were"} already there.` : "";
          toast.show({ kind: "undo", message: `Moved ${answer.moved.toLocaleString("en-IN")} ${answer.moved === 1 ? "ad" : "ads"} to ${answer.categoryName}.${there}`, onUndo: () => void undoMove(answer.eventId) });
          router.refresh();
        }}
      />
      <ReasonDialog
        key={extending ? "extend-open" : "extend-closed"}
        open={extending}
        title={`Extend ${selected.length} ${selected.length === 1 ? "ad" : "ads"}?`}
        body="Each ad ends later by the time you choose, counted from its current end (or from now, if it has already passed). Credits are not charged. You can undo this."
        reasons={EXTEND_CHOICES.map((choice) => choice.label)}
        requireReason
        reasonLabel="Extend by"
        reasonError="Choose how long to extend by."
        confirmLabel="Extend"
        onCancel={() => setExtending(false)}
        onConfirm={(result) => {
          setExtending(false);
          const choice = EXTEND_CHOICES.find((item) => item.label === result.reason);
          void run("extend", { hours: choice?.hours });
        }}
      />
      <ReasonDialog
        key={settingEnd ? "end-open" : "end-closed"}
        open={settingEnd}
        title={`Set the end time of ${selected.length} ${selected.length === 1 ? "ad" : "ads"}?`}
        body={
          <>
            <p>Every selected ad will end at this moment (India time). It must be in the future. Credits are not charged. You can undo this.</p>
            <label className="adm-k-label" htmlFor="ads-set-end">Ends on</label>
            <input id="ads-set-end" type="datetime-local" className="adm-k-input" data-tk="set-end-input" min={istInputValue(new Date(now).toISOString())} value={endValue} onChange={(event) => { setEndValue(event.target.value); setEndError(""); }} />
            {endError ? <p className="adm-k-err" role="alert">{endError}</p> : null}
          </>
        }
        confirmLabel="Set end time"
        onCancel={() => setSettingEnd(false)}
        onConfirm={() => {
          const iso = istInputToIso(endValue);
          if (!iso) return setEndError("Pick a date and time.");
          if (new Date(iso).getTime() <= Date.now()) return setEndError("Pick a time in the future.");
          setSettingEnd(false);
          void run("setEnd", { endsAt: iso });
        }}
      />
      <ReasonDialog
        key={removing ? "open" : "closed"}
        open={removing}
        title={`Remove ${selected.length} ${selected.length === 1 ? "ad" : "ads"}?`}
        body="The ads come down at once. Credits are not given back from here: open an ad to do that. You can undo this for 7 days."
        reasons={REMOVE_REASONS}
        requireReason
        textLabel="Add a note (optional)"
        typedConfirm={needsTyped ? String(selected.length) : undefined}
        confirmLabel={`Remove ${selected.length} ${selected.length === 1 ? "ad" : "ads"}`}
        danger
        onCancel={() => setRemoving(false)}
        onConfirm={(result) => {
          setRemoving(false);
          void run("remove", { reason: [result.reason, result.text].filter(Boolean).join(": "), confirm: needsTyped ? String(selected.length) : "" });
        }}
      />
    </div>
  );
}

/** All ads (H8.27): tabs, search, filters, a server-paginated table, and bulk pause, resume, extend or remove with one Undo for the whole batch. */
export function AdsView({ list, access, demoPanel }: { list: AdsList; access: AdsAccess; demoPanel: React.ReactNode }) {
  return (
    <ToastProvider>
      <Screen list={list} access={access} demoPanel={demoPanel} />
    </ToastProvider>
  );
}
