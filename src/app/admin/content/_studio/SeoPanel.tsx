"use client";

import { useState } from "react";
import { Button, ReasonDialog, SerpPreview, Toggle, counterTone } from "@/components/admin/ui";
import { SEO_DESCRIPTION_MAX, SEO_TITLE_MAX, type EditorState } from "./data";

function Counter({ length, max }: { length: number; max: number }) {
  return <span className={`adm-k-count adm-counter ${counterTone(length, undefined, max)}`} aria-live="polite">{length} / {max}</span>;
}

/**
 * Search and sharing (H8.31): how the page looks on Google, the SEO title and description with counters, the web address
 * (changing it later adds a redirect by itself) and the switch that hides the page from Google.
 */
export function SeoPanel({
  state,
  onChange,
  host,
  prefix,
  slug,
  wasPublic,
  saved,
  onChangeSlug,
}: {
  state: EditorState;
  onChange: (patch: Partial<EditorState>) => void;
  host: string;
  prefix: string;
  slug: string;
  wasPublic: boolean;
  /** False for an item that exists but whose address cannot change yet (a draft that was never saved is not a case here). */
  saved: boolean;
  onChangeSlug: (next: string) => Promise<string | null>;
}) {
  const [address, setAddress] = useState(slug);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const title = state.seoTitle.trim() || state.title.trim();
  const description = state.seoDescription.trim() || state.excerpt.trim();
  const edited = address.trim() !== slug;

  async function apply() {
    setBusy(true);
    setError("");
    const problem = await onChangeSlug(address.trim());
    setBusy(false);
    if (problem) setError(problem);
  }

  return (
    <section className="adm-card adm-st-card" aria-labelledby="st-seo-h" data-tk="seo-panel">
      <div className="adm-st-cardhead"><h2 id="st-seo-h">Search and sharing</h2></div>
      <div className="adm-st-cardbody">
        <SerpPreview title={title} description={description} url={`${host} › ${prefix} › ${slug}`} />
        <div className="adm-k-field">
          <label className="adm-k-label adm-k-lab" htmlFor="st-seo-title"><span>SEO title</span><Counter length={state.seoTitle.length} max={SEO_TITLE_MAX} /></label>
          <input id="st-seo-title" className="adm-k-input" value={state.seoTitle} placeholder={state.title} onChange={(event) => onChange({ seoTitle: event.target.value })} />
          <p className="adm-k-help">Leave empty to use the title.</p>
        </div>
        <div className="adm-k-field">
          <label className="adm-k-label adm-k-lab" htmlFor="st-seo-desc"><span>Meta description</span><Counter length={state.seoDescription.length} max={SEO_DESCRIPTION_MAX} /></label>
          <textarea id="st-seo-desc" className="adm-k-input" rows={3} value={state.seoDescription} placeholder={state.excerpt} onChange={(event) => onChange({ seoDescription: event.target.value })} />
          <p className="adm-k-help">Leave empty to use the short summary.</p>
        </div>
        <div className="adm-k-field">
          <label className="adm-k-label" htmlFor="st-slug">Web address</label>
          <div className="adm-st-slug">
            <span aria-hidden="true">/{prefix}/</span>
            <input id="st-slug" className="adm-k-input" value={address} disabled={!saved} onChange={(event) => setAddress(event.target.value)} aria-describedby="st-slug-help" />
            <span aria-hidden="true">/</span>
          </div>
          <p className="adm-k-help" id="st-slug-help">Changing it later adds a redirect by itself.</p>
          {error ? <p className="adm-k-err" role="alert" data-tk="slug-error">{error}</p> : null}
          {edited ? <Button kind="secondary" busy={busy} onClick={() => (wasPublic ? setConfirm(true) : void apply())}>Change address</Button> : null}
        </div>
        <Toggle checked={state.noindex} onChange={(next) => onChange({ noindex: next })} label="Hide from Google" />
      </div>
      <ReasonDialog
        open={confirm}
        title="Change the web address?"
        body={<p>People and Google who use the old address are sent to the new one by themselves, so no link breaks.</p>}
        confirmLabel="Change address"
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          setConfirm(false);
          await apply();
        }}
      />
    </section>
  );
}
