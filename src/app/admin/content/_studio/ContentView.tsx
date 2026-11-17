"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Plus } from "lucide-react";
import { Badge, Button, Drawer, EmptyState, PageHeader, Tabs, ToastProvider, type BadgeTone } from "@/components/admin/ui";
import type { EditorItem, ListRow, Option, StudioKind } from "@/server/content/studio/admin";
import type { BuiltInRow } from "@/server/content/studio/builtin";
import type { ContentStatus } from "@/server/models/content";
import { createItemAction } from "../actions";
import { Editor } from "./Editor";
import "./studio.css";

const SEARCH_DEBOUNCE_MS = 350;
const TAB_LABELS: Record<StudioKind, string> = { blog: "Blog", help: "Help" };
const STATUS_FILTERS: { key: ContentStatus | ""; label: string }[] = [
  { key: "", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "review", label: "In review" },
  { key: "scheduled", label: "Scheduled" },
  { key: "published", label: "Published" },
];
const STATUS_TONE: Record<ContentStatus, BadgeTone> = { draft: "neutral", review: "pri", scheduled: "info", published: "ok", unpublished: "bad" };
const STATUS_WORD: Record<ContentStatus, string> = { draft: "Draft", review: "In review", scheduled: "Scheduled", published: "Published", unpublished: "Off the site" };

const DAY = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });

function editedWord(row: ListRow): string {
  return `${row.status === "published" ? "updated" : "edited"} ${DAY.format(new Date(row.updatedAt))}`;
}

export type StudioProps = {
  tab: StudioKind;
  status: ContentStatus | "";
  q: string;
  rows: ListRow[];
  builtIns: BuiltInRow[];
  builtInScreen: string;
  counts: Record<StudioKind, number>;
  item: EditorItem | null;
  authors: Option[];
  categories: Option[];
  host: string;
  prefix: string;
  canPublish: boolean;
  canWrite: boolean;
  problem: string;
};

function NewDrawer({ kind, onClose, onCreated }: { kind: StudioKind; onClose: () => void; onCreated: (id: string) => void }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const word = kind === "blog" ? "post" : "article";
  async function create() {
    if (!title.trim()) return setError(`Write a title for the ${word}.`);
    setBusy(true);
    setError("");
    const result = await createItemAction({ kind, title });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    onCreated(result.itemId);
  }
  return (
    <Drawer
      open
      title={kind === "blog" ? "New post" : "New article"}
      subtitle="It starts as a draft. Nothing goes live until you publish."
      onClose={onClose}
      footer={
        <>
          <Button kind="quiet" onClick={onClose}>Cancel</Button>
          <span className="adm-k-sp" />
          <Button kind="primary" busy={busy} onClick={() => void create()}>Start writing</Button>
        </>
      }
    >
      {error ? <p className="adm-k-err" role="alert" data-tk="new-error">{error}</p> : null}
      <div className="adm-k-field">
        <label className="adm-k-label" htmlFor="st-new-title">Title <span className="adm-k-req" aria-hidden="true">*</span></label>
        <input id="st-new-title" className="adm-k-input" required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void create()} />
        <p className="adm-k-help">The web address is made from the title. You can change it in the editor.</p>
      </div>
    </Drawer>
  );
}

/** The content studio (H8.31): blog and help lists, the editor in the middle, search and publishing on the right. Tab, filter, search and the open item live in the address. */
export function ContentView(props: StudioProps) {
  const { tab, status, q, rows, counts, item } = props;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [search, setSearch] = useState(q);
  const [creating, setCreating] = useState(false);
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

  const word = tab === "blog" ? "post" : "article";
  return (
    <ToastProvider>
      <div className="adm-k" data-tk="studio" data-open={item ? "yes" : "no"}>
        <PageHeader
          crumbs={[{ label: "Website" }]}
          title="Content studio"
          purpose="Blog and help articles. Review before anything goes live."
          primary={props.canWrite ? { key: "new", label: tab === "blog" ? "New post" : "New article", icon: Plus, onClick: () => setCreating(true) } : undefined}
        />
        <section className="adm-card adm-st-tabs">
          <Tabs idPrefix="studio" label="Content types" active={tab} items={(Object.keys(TAB_LABELS) as StudioKind[]).map((key) => ({ key, label: TAB_LABELS[key], count: counts[key] }))} onChange={(key) => go({ tab: key === "blog" ? null : key, item: null, status: null, q: null })} />
        </section>
        <div className="adm-st-grid" role="tabpanel" id={`studio-panel-${tab}`} aria-labelledby={`studio-${tab}`}>
          <section className="adm-card adm-st-list" aria-label={`${TAB_LABELS[tab]} list`} data-tk="studio-list">
            <div className="adm-st-listtop">
              <input className="adm-k-input" type="search" aria-label={`Search ${tab}`} placeholder={`Search ${tab}`} value={search} onChange={(event) => setSearch(event.target.value)} />
              <div className="adm-st-chips" role="group" aria-label="Filter by status">
                {STATUS_FILTERS.map((filter) => (
                  <button key={filter.key || "all"} type="button" className="adm-k-chip" aria-pressed={status === filter.key} onClick={() => go({ status: filter.key || null, item: null })}>
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
            {rows.length === 0 && (props.builtIns.length === 0 || q || status) ? (
              <EmptyState title={`No ${tab === "blog" ? "posts" : "articles"} here`} why={q || status ? "Nothing matches these filters." : `Start the first ${word} with the button above.`} />
            ) : rows.length === 0 ? null : (
              <ul className="adm-st-rows">
                {rows.map((row) => (
                  <li key={row.id}>
                    <button type="button" className="adm-st-row" data-tk="content-row" aria-current={item?.id === row.id ? "true" : undefined} onClick={() => go({ item: row.id })}>
                      <strong>{row.title}</strong>
                      <span className="adm-st-rowmeta">
                        <Badge tone={STATUS_TONE[row.status]}>{STATUS_WORD[row.status]}</Badge>
                        <small>{[row.categoryName, editedWord(row)].filter(Boolean).join(" · ")}</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {props.builtIns.length > 0 ? (
              <div className="adm-st-built" data-tk="built-in-list">
                <h2 className="adm-st-builthead">Built in, live on the site now</h2>
                <p className="adm-k-help">These came with the site. {props.canWrite ? "Open one to edit its words or remove it." : "Only editors can change them."}</p>
                <ul className="adm-st-rows">
                  {props.builtIns.map((row) => (
                    <li key={row.id}>
                      <Link className="adm-st-row" data-tk="built-in-row" href={`${props.builtInScreen}?open=${row.id}`}>
                        <strong>{row.title}</strong>
                        <span className="adm-st-rowmeta">
                          <Badge tone="info">Built in</Badge>
                          <Badge tone={row.status === "published" ? "ok" : "neutral"}>{row.status === "published" ? "Published" : "Draft"}</Badge>
                          <small>{[row.group, `/${row.slug}/`].filter(Boolean).join(" · ")}</small>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
          {item ? (
            <div className="adm-st-work">
              <button type="button" className="adm-st-back" onClick={() => go({ item: null })}>
                <ChevronLeft aria-hidden="true" size={16} /> All {tab === "blog" ? "blog posts" : "help articles"}
              </button>
              {props.problem ? <p className="adm-k-err" role="alert">{props.problem}</p> : null}
              <Editor key={`${item.id}-${item.version}-${item.status}`} item={item} authors={props.authors} categories={props.categories} host={props.host} prefix={props.prefix} canPublish={props.canPublish} canWrite={props.canWrite} />
            </div>
          ) : (
            <section className="adm-card adm-st-pick" data-tk="studio-pick">
              {props.problem ? <p className="adm-k-err" role="alert">{props.problem}</p> : null}
              <EmptyState title={`Pick a ${word}`} why="Choose one on the left to edit it, or start a new one." />
            </section>
          )}
        </div>
        {creating ? <NewDrawer kind={tab} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); go({ item: id }); }} /> : null}
      </div>
    </ToastProvider>
  );
}
