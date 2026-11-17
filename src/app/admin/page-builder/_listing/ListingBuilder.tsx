"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Search, Send } from "lucide-react";
import { undoAction } from "@/app/admin/undo-actions";
import { Badge } from "@/components/admin/ui/Badge";
import { Button } from "@/components/admin/ui/Button";
import { Notice } from "@/components/admin/ui/Notice";
import { Skeleton } from "@/components/admin/ui/Skeleton";
import { TextField } from "@/components/admin/ui/TextField";
import { ToastProvider, useToast } from "@/components/admin/ui/Toast";
import { Toggle } from "@/components/admin/ui/Toggle";
import { explainAddressAction, loadListingHeaderAction, publishListingHeaderAction, saveListingHeaderAction } from "./actions";
import { FIELD_WORDS, H1_MAX, HEADER_VARIABLES, INTRO_MAX, SOURCE_WORDS, previewHeader, sameHeader, scopeOf, type HeaderProps } from "./model";
import type { ExplainedAddress, ListingHeaderState } from "./server";
import "./listing.css";

export type CategoryOption = { slug: string; name: string };

function HeaderCard({ categories }: { categories: CategoryOption[] }) {
  const toast = useToast();
  const [category, setCategory] = useState("");
  const [state, setState] = useState<ListingHeaderState | null>(null);
  const [error, setError] = useState("");
  const [header, setHeader] = useState<HeaderProps | null>(null);
  const [saved, setSaved] = useState<HeaderProps | null>(null);
  const [busy, setBusy] = useState<"" | "save" | "publish">("");
  const scope = scopeOf(category);

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
      <p className="adm-k-help">The words at the top of the category, city and area pages. Pick all listing pages, or one category that needs its own wording.</p>
      <div className="adm-k-field adm-lb-scope">
        <label className="adm-k-label" htmlFor="lb-scope">Applies to</label>
        <select id="lb-scope" className="adm-k-select" value={category} onChange={(event) => {
            setState(null);
            setHeader(null);
            setCategory(event.target.value);
          }} disabled={busy !== ""}>
          <option value="">All listing pages (default)</option>
          {categories.map((row) => (
            <option key={row.slug} value={row.slug}>{row.name}</option>
          ))}
        </select>
      </div>
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

/** The Listing tab of the Page builder (H8.44): the heading and intro of the listing pages, and which source each address uses. */
export function ListingBuilder({ categories }: { categories: CategoryOption[] }) {
  return (
    <ToastProvider>
      <div className="adm-lb" data-tk="listing-builder">
        <HeaderCard categories={categories} />
        <ExplainCard />
        <p className="adm-k-help">The filters, the ads, the nearby cities and the other blocks are still edited in <Link href="/admin/listing-pages/">Listing pages</Link>.</p>
      </div>
    </ToastProvider>
  );
}
