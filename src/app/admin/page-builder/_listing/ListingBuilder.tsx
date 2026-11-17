"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Search, Send } from "lucide-react";
import { CardWidthForm } from "@/app/admin/listing-pages/CardWidthForm";
import { PageTitleEditor } from "@/components/admin/PageTitleEditor";
import { LayoutEditor } from "@/components/admin/layout-editor/LayoutEditor";
import { typesForPage } from "@/server/layout/blocks";
import type { CardWidth } from "@/server/listings/card-width-config";
import { Preview } from "../_home/Preview";
import { undoAction } from "@/app/admin/undo-actions";
import { Badge } from "@/components/admin/ui/Badge";
import { Button } from "@/components/admin/ui/Button";
import { Notice } from "@/components/admin/ui/Notice";
import { Skeleton } from "@/components/admin/ui/Skeleton";
import { TextField } from "@/components/admin/ui/TextField";
import { ToastProvider, useToast } from "@/components/admin/ui/Toast";
import { Toggle } from "@/components/admin/ui/Toggle";
import { explainAddressAction, loadListingHeaderAction, loadListingTitleAction, publishListingHeaderAction, saveListingHeaderAction } from "./actions";
import { FIELD_WORDS, H1_MAX, HEADER_VARIABLES, INTRO_MAX, SOURCE_WORDS, previewHeader, sameHeader, scopeOf, type HeaderProps } from "./model";
import type { ExplainedAddress, ListingHeaderState, ListingTitleState } from "./server";
import "./listing.css";

export type CategoryOption = { slug: string; name: string };

function HeaderCard({ scope }: { scope: string }) {
  const toast = useToast();
  const [state, setState] = useState<ListingHeaderState | null>(null);
  const [error, setError] = useState("");
  const [header, setHeader] = useState<HeaderProps | null>(null);
  const [saved, setSaved] = useState<HeaderProps | null>(null);
  const [busy, setBusy] = useState<"" | "save" | "publish">("");

  const load = useCallback(async (nextScope: string) => {
    setError("");
    const res = await loadListingHeaderAction(nextScope);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setState(res.state);
    setHeader(res.state.header);
    setSaved(res.state.header);
  }, []);

  useEffect(() => {
    // Loading from the server when the scope changes: the state arrives after the await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(scope);
  }, [load, scope]);

  const dirty = header !== null && saved !== null && !sameHeader(header, saved);
  const sample = useMemo(() => ({ category: state?.categoryName || "Dating", city: "Surat" }), [state?.categoryName]);

  async function saveDraft(): Promise<boolean> {
    if (!header) return false;
    setBusy("save");
    const res = await saveListingHeaderAction(scope, header);
    setBusy("");
    if (!res.ok) {
      toast.show({ kind: "error", message: res.error });
      return false;
    }
    setSaved(header);
    toast.show({ kind: "success", message: "Draft saved." });
    await load(scope);
    return true;
  }

  async function publish() {
    if (!header) return;
    if ((dirty || state?.liveVersion === 0 || state?.inherited || !state?.hasDraft) && !(await saveDraft())) return;
    setBusy("publish");
    const res = await publishListingHeaderAction(scope, "");
    setBusy("");
    if (!res.ok) {
      toast.show({ kind: "error", message: res.error });
      return;
    }
    const label = state?.categoryName ? `the listing pages of ${state.categoryName}` : "the listing pages";
    if (res.canUndo) {
      toast.show({
        kind: "undo",
        message: `Published ${label} (version ${res.version}).`,
        onUndo: async () => {
          const outcome = await undoAction(res.eventId);
          toast.show({ kind: outcome.ok ? "success" : "error", message: outcome.ok ? "Publishing undone." : outcome.message });
          await load(scope);
        },
      });
    } else {
      toast.show({ kind: "success", message: `Published ${label} (version ${res.version}).` });
    }
    await load(scope);
  }

  const statusBadge = !state ? null : dirty ? <Badge tone="warn">Unsaved changes</Badge> : state.inherited ? <Badge>Using the default</Badge> : state.hasDraft && state.liveVersion > 0 ? <Badge tone="ok">Published, version {state.liveVersion}</Badge> : state.hasDraft ? <Badge tone="warn">Draft, not published</Badge> : <Badge tone="ok">Published</Badge>;

  return (
    <section className="adm-card adm-lb-card" aria-labelledby="lb-header-h" data-tk="listing-header-card">
      <div className="adm-lb-head">
        <h2 id="lb-header-h">Heading and intro</h2>
        {statusBadge}
      </div>
      <p className="adm-k-help">The words at the top of the category, city and area pages for the pages chosen above.</p>
      {error ? <Notice kind="error">{error}</Notice> : null}
      {!header || !state ? (
        error ? null : <Skeleton lines={4} />
      ) : (
        <div className="adm-lb-form">
          {state.inherited ? <Notice kind="info">This category shows the default wording. When you publish, it gets its own copy of the listing layout with the words below.</Notice> : null}
          <TextField label="Heading template" value={header.h1Template} onChange={(value) => setHeader({ ...header, h1Template: value })} max={H1_MAX} required help="{h1} is the heading the page works out by itself (from SEO templates and addresses). Keep {h1} to leave it as it is." />
          <TextField label="Intro template" value={header.introTemplate} onChange={(value) => setHeader({ ...header, introTemplate: value })} max={INTRO_MAX} multiline help="Leave empty or {h1} to use the page's own intro." />
          <p className="adm-k-help" data-tk="header-variables">
            You can use: {HEADER_VARIABLES.map((token) => <code key={token}>{token}</code>)}
          </p>
          <div className="adm-lb-toggles">
            <Toggle checked={header.showCount} onChange={(next) => setHeader({ ...header, showCount: next })} label="Show the number of ads" />
            <Toggle checked={header.showUpdated} onChange={(next) => setHeader({ ...header, showUpdated: next })} label="Show the last updated date" />
          </div>
          <div className="adm-lb-sample" data-tk="header-sample">
            <small>Looks like, for {sample.category} in {sample.city}</small>
            <strong>{previewHeader(header.h1Template, sample) || `${sample.category} in ${sample.city}`}</strong>
          </div>
          <div className="adm-lb-actions">
            <Button busy={busy === "save"} disabled={!dirty || busy !== ""} onClick={() => void saveDraft()}>Save draft</Button>
            <Button kind="primary" icon={Send} busy={busy === "publish"} disabled={busy !== "" || (!dirty && !state.inherited && !state.hasDraft && state.liveVersion > 0)} onClick={() => void publish()}>Publish</Button>
          </div>
        </div>
      )}
    </section>
  );
}

function ExplainCard() {
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ExplainedAddress | null>(null);

  async function show() {
    setBusy(true);
    setError("");
    const res = await explainAddressAction(address);
    setBusy(false);
    if (!res.ok) {
      setResult(null);
      setError(res.error);
      return;
    }
    setResult(res.explained);
  }

  return (
    <section className="adm-card adm-lb-card" aria-labelledby="lb-explain-h" data-tk="explain-card">
      <h2 id="lb-explain-h">Which text does this address use?</h2>
      <p className="adm-k-help">Type a category page or a city page to see where its heading, intro and questions come from.</p>
      <form className="adm-lb-ask" onSubmit={(event) => { event.preventDefault(); void show(); }}>
        <div className="adm-k-field">
          <label className="adm-k-label" htmlFor="lb-address">Address</label>
          <input id="lb-address" className="adm-k-input" value={address} placeholder="/dating/surat/" maxLength={120} onChange={(event) => setAddress(event.target.value)} />
        </div>
        <Button type="submit" icon={Search} busy={busy} disabled={!address.trim()}>Show the source</Button>
      </form>
      {error ? <Notice kind="warn">{error}</Notice> : null}
      {result ? (
        <div className="adm-lb-result" data-tk="explain-result">
          <p className="adm-k-help">
            {result.path}. {result.mode === "content" ? "The pages put the Content studio first." : "The pages use today's order: the address settings first, the Content studio only when switched on."}
          </p>
          <table className="adm-lb-table">
            <thead>
              <tr><th scope="col">Part</th><th scope="col">Used now</th><th scope="col">From</th></tr>
            </thead>
            <tbody>
              {result.fields.map((row) => (
                <tr key={row.field} data-field={row.field}>
                  <th scope="row">{FIELD_WORDS[row.field]}</th>
                  <td>{row.winner ? <span className="adm-lb-text">{row.winner.text}</span> : <span className="adm-k-help">Nothing</span>}</td>
                  <td>
                    {row.winner ? <Badge tone={row.winner.source === "content" ? "ok" : "neutral"}>{SOURCE_WORDS[row.winner.source]}</Badge> : null}
                    {row.others.length ? <small className="adm-lb-others">Also written in: {row.others.map((other) => SOURCE_WORDS[other.source]).join("; ")}</small> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="adm-lb-links">
            <Button size="sm" icon={ExternalLink} href="/admin/content/">Write your own text in the Content studio</Button>
            <Button size="sm" icon={ExternalLink} href="/admin/seo/">Open SEO addresses</Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

const URL_CHOICE = "__url";
const URL_SHAPE = /^\/[a-zA-Z0-9\-._~/]{1,300}$/;

/** One choice for the whole tab: which pages the heading, the Google text, the layout and the preview below are for. */
function ScopeCard({ categories, choice, address, onChoice, onAddress }: { categories: CategoryOption[]; choice: string; address: string; onChoice: (next: string) => void; onAddress: (next: string) => void }) {
  const bad = choice === URL_CHOICE && address !== "" && !URL_SHAPE.test(address);
  return (
    <section className="adm-card adm-lb-card" aria-labelledby="lb-scope-h" data-tk="listing-scope-card">
      <h2 id="lb-scope-h">Which pages</h2>
      <div className="adm-lb-scoperow">
        <div className="adm-k-field adm-lb-scope">
          <label className="adm-k-label" htmlFor="lb-scope">Applies to</label>
          <select id="lb-scope" className="adm-k-select" value={choice} onChange={(event) => onChoice(event.target.value)}>
            <option value="">All listing pages (default)</option>
            {categories.map((row) => (
              <option key={row.slug} value={row.slug}>{row.name}</option>
            ))}
            <option value={URL_CHOICE}>One exact address...</option>
          </select>
        </div>
        {choice === URL_CHOICE ? (
          <div className="adm-k-field adm-lb-scope">
            <label className="adm-k-label" htmlFor="lb-scope-url">Address</label>
            <input id="lb-scope-url" className="adm-k-input" value={address} placeholder="/property/surat/" maxLength={300} aria-invalid={bad ? true : undefined} onChange={(event) => onAddress(event.target.value)} />
            {bad ? <p className="adm-k-err" role="alert">Type a page address such as /property/surat/.</p> : null}
          </div>
        ) : null}
      </div>
      <p className="adm-k-help">A layout for an exact address wins over a category layout, which wins over the default.</p>
    </section>
  );
}

function TitleCard({ scope }: { scope: string }) {
  const [state, setState] = useState<ListingTitleState | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    void loadListingTitleAction(scope).then((res) => {
      if (!live) return;
      if (res.ok) setState(res.title);
      else setError(res.error);
    });
    return () => {
      live = false;
    };
  }, [scope]);

  return (
    <section className="adm-lb-titlewrap" aria-label="Google title and description" data-tk="listing-title-card">
      {error ? <Notice kind="warn">{error}</Notice> : null}
      {!state ? (
        error ? null : <Skeleton lines={3} />
      ) : (
        <PageTitleEditor key={JSON.stringify(state.target)} target={state.target} initial={state.initial} siteLabel={state.siteLabel} previewVars={state.previewVars} help={state.help} />
      )}
      <p className="adm-k-help">The same title and description are in <Link href="/admin/seo/page-titles/">SEO, Page titles</Link>, with every other page.</p>
    </section>
  );
}

/** The Listing tab of the Page builder (H8.44, H8.55): everything the old Listing pages screen had, for one choice of pages, with a preview beside it. */
export function ListingBuilder({ categories, initialCategory = "", initialAddress = "", cardWidth }: { categories: CategoryOption[]; initialCategory?: string; initialAddress?: string; cardWidth: CardWidth }) {
  const [choice, setChoice] = useState(initialAddress ? URL_CHOICE : initialCategory);
  const [address, setAddress] = useState(initialAddress);
  const urlOk = choice === URL_CHOICE && URL_SHAPE.test(address);
  const scope = choice === URL_CHOICE ? (urlOk ? `url:${address.endsWith("/") ? address : `${address}/`}` : "default") : scopeOf(choice);
  const live = choice === URL_CHOICE ? (urlOk ? address : "/") : `/${choice || categories[0]?.slug || ""}/`;
  const exact = choice === URL_CHOICE;
  return (
    <ToastProvider>
      <div className="adm-lb-grid" data-tk="listing-builder">
        <div className="adm-lb">
          <ScopeCard categories={categories} choice={choice} address={address} onChoice={(next) => { setChoice(next); if (next !== URL_CHOICE) setAddress(""); }} onAddress={setAddress} />
          {exact ? <Notice kind="info">An exact address has no heading and intro template of its own. Its layout and its Google text are below.</Notice> : <HeaderCard key={scope} scope={scope} />}
          <TitleCard scope={scope} />
          <section className="adm-lb-layout" aria-label="Page layout" data-tk="listing-layout">
            <LayoutEditor key={scope} pageKey="listing" scope={scope} allowedTypes={typesForPage("listing")} previewHref={live} />
          </section>
          <CardWidthForm initial={cardWidth} />
          <ExplainCard />
        </div>
        <aside className="adm-lb-side" aria-label="Preview">
          <section className="adm-card adm-lb-card" aria-labelledby="lb-preview-h" data-tk="listing-preview">
            <h2 id="lb-preview-h">Preview</h2>
            <Preview device="laptop" version={0} reloadKey={0} src={live} note={`The live page ${live}. A change shows here after you publish it.`} />
          </section>
        </aside>
      </div>
    </ToastProvider>
  );
}
