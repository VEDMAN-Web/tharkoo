"use client";

import Link from "next/link";
import { Plus, Search, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import "@/app/admin/_catalog/catalog.css";
import { Button, PageHeader, ToastProvider, useToast } from "@/components/admin/ui";
import type { PlaceRowView, PlacesScreenData } from "@/server/locations/screen";
import { ImportDialog } from "./ImportDialog";
import { NewPlaceDialog } from "./NewPlaceDialog";
import { PlaceDetailPane } from "./PlaceDetailPane";
import { PlaceList } from "./PlaceList";
import { reorderPlacesAction } from "../reorder-action";
import { tabOf, urlFor, type TabKey } from "./model";

const SEARCH_DEBOUNCE_MS = 350;

function Screen({ data, tab: startTab }: { data: PlacesScreenData; tab: TabKey }) {
  const router = useRouter();
  const toast = useToast();
  const [local, setLocal] = useState<{ base: string; ids: string[] } | null>(null);
  const [tab, setTab] = useState<TabKey>(startTab);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState(data.q);
  const sent = useRef(data.q);
  const dirty = useRef(false);
  const { detail } = data;
  const base = { q: data.q, page: data.page };

  useEffect(() => {
    const onPop = () => setTab(tabOf(new URLSearchParams(window.location.search).get("tab")));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (search.trim() === sent.current) return;
    const id = window.setTimeout(() => {
      sent.current = search.trim();
      router.replace(urlFor({ q: search.trim(), page: 1 }, "", "details"), { scroll: false });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [search, router]);

  const onDirty = useCallback((value: boolean) => {
    dirty.current = value;
  }, []);

  function changeTab(next: TabKey) {
    if (!detail) return;
    setTab(next);
    window.history.pushState(null, "", urlFor(base, detail.id, next));
  }

  function open(event: React.MouseEvent, row: PlaceRowView) {
    if (dirty.current && row.id !== detail?.id && !window.confirm("You have unsaved changes. Leave without saving?")) event.preventDefault();
  }

  const baseKey = data.rows.map((row) => row.id).join(",");
  const order = local && local.base === baseKey ? local.ids : data.rows.map((row) => row.id);
  const byId = new Map(data.rows.map((row) => [row.id, row]));
  const rows = [...order.map((id) => byId.get(id)).filter((row): row is PlaceRowView => Boolean(row)), ...data.rows.filter((row) => !order.includes(row.id))];
  // Order only means something in the plain list. A search shows a part of it, so dragging is off while one is on.
  const canReorder = !data.q;

  async function move(from: number, to: number) {
    if (to < 0 || to >= rows.length || from === to || rows[from].type !== rows[to].type) return;
    const next = [...rows];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setLocal({ base: baseKey, ids: next.map((row) => row.id) });
    const result = await reorderPlacesAction(next.filter((row) => row.type === item.type).map((row) => row.id));
    toast.show(result.ok ? { kind: "success", message: "Order saved." } : { kind: "error", message: result.message });
    if (!result.ok) setLocal(null);
    router.refresh();
  }

  const pagerHref = (page: number) => urlFor({ q: data.q, page }, detail?.id ?? "", tab);
  return (
    <div className="adm-k" data-tk="places-screen">
      <PageHeader
        crumbs={[{ label: "Catalogue" }]}
        title="Cities & areas"
        purpose="Cities, states and countries, their pictures, and the districts inside each city."
        primary={{ key: "new", label: "New place", icon: Plus, kind: "primary", onClick: () => setCreating(true) }}
        secondary={[{ key: "import", label: "Import cities and areas (CSV)", icon: Upload, onClick: () => setImporting(true) }]}
      />
      <div className="adm-cat" data-view={data.chosen ? "detail" : "list"} data-tk="places-layout">
        <section className="adm-card adm-cat-listcard" aria-labelledby="place-list-title">
          <div className="adm-cat-listhead">
            <h2 id="place-list-title">Places</h2>
            <span data-tk="place-total">{`${data.total.toLocaleString("en-IN")} ${data.total === 1 ? "place" : "places"}`}</span>
          </div>
          <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--adm-line2)" }}>
            <label className="adm-k-sr" htmlFor="place-search">Search places</label>
            <div style={{ position: "relative" }}>
              <Search aria-hidden="true" size={16} style={{ position: "absolute", left: 10, top: 12, color: "var(--adm-kmuted)" }} />
              <input id="place-search" className="adm-k-input" type="search" placeholder="Search by name" autoComplete="off" value={search} onChange={(event) => setSearch(event.target.value)} style={{ width: "100%", paddingLeft: 32 }} data-tk="place-search" />
            </div>
          </div>
          <PlaceList rows={data.rows} selectedId={detail?.id ?? ""} hrefFor={(row) => urlFor(base, row.id, tab)} onOpen={open} onMove={(from, to) => void move(from, to)} canReorder={canReorder} empty={data.q ? "No place matches this search." : "No places yet. Use New place to add the first one."} />
          {canReorder && data.rows.length > 1 ? <p className="adm-cat-listnote" data-tk="place-order-note" style={{ margin: 0 }}>Drag or use the arrows to change the order of cities, or of states, on this page. It saves at once.</p> : null}
          {data.pages > 1 ? (
            <nav className="adm-cat-listnote" aria-label="Pages of places" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }} data-tk="place-pager">
              {data.page > 1 ? <Link className="adm-cat-linkbtn" href={pagerHref(data.page - 1)} data-tk="page-prev">Previous</Link> : <span />}
              <span>{`Page ${data.page} of ${data.pages}`}</span>
              {data.page < data.pages ? <Link className="adm-cat-linkbtn" href={pagerHref(data.page + 1)} data-tk="page-next">Next</Link> : <span />}
            </nav>
          ) : null}
        </section>
        {detail ? (
          <PlaceDetailPane key={detail.id} detail={detail} tab={tab} onTab={changeTab} onDirty={onDirty} listHref={urlFor(base, "", "details")} />
        ) : (
          <section className="adm-card adm-cat-detail">
            <div className="adm-cat-body">
              <p className="adm-cat-empty">{data.q ? "Nothing to show for this search." : "No place yet."}</p>
              <Button kind="primary" icon={Plus} onClick={() => setCreating(true)}>New place</Button>
            </div>
          </section>
        )}
      </div>
      <ImportDialog
        open={importing}
        onClose={() => setImporting(false)}
        onDone={(message) => {
          toast.show({ kind: "success", message });
          router.refresh();
        }}
      />
      <NewPlaceDialog open={creating} choices={data.choices} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); router.push(urlFor({ q: "", page: 1 }, id, "details")); router.refresh(); }} />
    </div>
  );
}

/** Cities & areas: ONE master-detail screen. The searchable, paged list of places is on the left; the chosen place with its tabs is on the right (a phone shows one at a time). */
export function PlacesScreen(props: { data: PlacesScreenData; tab: TabKey }) {
  return (
    <ToastProvider>
      <Screen {...props} />
    </ToastProvider>
  );
}
