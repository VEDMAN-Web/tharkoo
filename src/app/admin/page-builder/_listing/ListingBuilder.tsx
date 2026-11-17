"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import { CardWidthForm } from "@/app/admin/listing-pages/CardWidthForm";
import { saveCardWidthAction } from "@/app/admin/listing-pages/card-width-actions";
import { PageTitleEditor } from "@/components/admin/PageTitleEditor";
import { LayoutEditor, type LayoutExtras } from "@/components/admin/layout-editor/LayoutEditor";
import type { Props } from "@/components/admin/layout-editor/fields";
import { typesForPage } from "@/server/layout/blocks";
import type { CardWidth } from "@/server/listings/card-width-config";
import { Preview } from "../_home/Preview";
import { Badge } from "@/components/admin/ui/Badge";
import { Button } from "@/components/admin/ui/Button";
import { Notice } from "@/components/admin/ui/Notice";
import { Skeleton } from "@/components/admin/ui/Skeleton";
import { TextField } from "@/components/admin/ui/TextField";
import { Toggle } from "@/components/admin/ui/Toggle";
import { explainAddressAction, loadListingTitleAction } from "./actions";
import { FIELD_WORDS, H1_MAX, HEADER_VARIABLES, INTRO_MAX, SOURCE_WORDS, previewHeader, scopeOf } from "./model";
import type { ExplainedAddress, ListingTitleState } from "./server";
import "./listing.css";

export type CategoryOption = { slug: string; name: string };

function HeaderCard({ props, update, categoryName }: { props: Props; update: (patch: Props) => void; categoryName: string }) {
  const h1Template = typeof props.h1Template === "string" ? props.h1Template : "";
  const introTemplate = typeof props.introTemplate === "string" ? props.introTemplate : "";
  const sample = { category: categoryName || "Dating", city: "Surat" };
  return (
    <section className="adm-card adm-lb-card" aria-labelledby="lb-header-h" data-tk="listing-header-card">
      <div className="adm-lb-head">
        <h2 id="lb-header-h">Heading and intro</h2>
      </div>
      <p className="adm-k-help">The words at the top of the category, city and area pages for the pages chosen above. Saved and published with the layout below.</p>
      <div className="adm-lb-form">
        <TextField label="Heading template" value={h1Template} onChange={(value) => update({ h1Template: value })} max={H1_MAX} required help="{h1} is the heading the page works out by itself (from SEO templates and addresses). Keep {h1} to leave it as it is." />
        <TextField label="Intro template" value={introTemplate} onChange={(value) => update({ introTemplate: value })} max={INTRO_MAX} multiline help="Leave empty or {h1} to use the page's own intro." />
        <p className="adm-k-help" data-tk="header-variables">
          You can use: {HEADER_VARIABLES.map((token) => <code key={token}>{token}</code>)}
        </p>
        <div className="adm-lb-toggles">
          <Toggle checked={props.showCount !== false} onChange={(next) => update({ showCount: next })} label="Show the number of ads" />
          <Toggle checked={props.showUpdated !== false} onChange={(next) => update({ showUpdated: next })} label="Show the last updated date" />
        </div>
        <div className="adm-lb-sample" data-tk="header-sample">
          <small>Looks like, for {sample.category} in {sample.city}</small>
          <strong>{previewHeader(h1Template, sample) || `${sample.category} in ${sample.city}`}</strong>
        </div>
      </div>
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
        <PageTitleEditor key={JSON.stringify(state.target)} target={state.target} initial={state.initial} siteLabel={state.siteLabel} previewVars={state.previewVars} help={state.help} saveLabel="Save Google title and description" />
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
  const categoryName = categories.find((row) => row.slug === choice)?.name ?? "";
  const [width, setWidth] = useState<CardWidth>(cardWidth);
  const [savedWidth, setSavedWidth] = useState<CardWidth>(cardWidth);
  const extras: LayoutExtras = {
    headerType: "listingHeader",
    top: ({ props, update }) => (exact ? <Notice kind="info">An exact address has no heading and intro template of its own. Its layout and its Google text are on this page.</Notice> : <HeaderCard props={props} update={update} categoryName={categoryName} />),
    bottom: <CardWidthForm width={width} onChange={setWidth} />,
    dirty: width !== savedWidth,
    publish: async () => {
      if (width === savedWidth) return null;
      const res = await saveCardWidthAction(width);
      if (!res.ok) return `the card width was not saved: ${res.message}`;
      setSavedWidth(width);
      return null;
    },
  };
  return (
    <div className="adm-lb-grid" data-tk="listing-builder">
      <div className="adm-lb">
        <ScopeCard categories={categories} choice={choice} address={address} onChoice={(next) => { setChoice(next); if (next !== URL_CHOICE) setAddress(""); }} onAddress={setAddress} />
        <TitleCard scope={scope} />
        <section className="adm-lb-layout" aria-label="Page layout" data-tk="listing-layout">
          <LayoutEditor key={scope} pageKey="listing" scope={scope} allowedTypes={typesForPage("listing")} previewHref={live} extras={extras} />
        </section>
        <ExplainCard />
      </div>
      <aside className="adm-lb-side" aria-label="Preview">
        <section className="adm-card adm-lb-card" aria-labelledby="lb-preview-h" data-tk="listing-preview">
          <h2 id="lb-preview-h">Preview</h2>
          <Preview device="laptop" version={0} reloadKey={0} src={live} note={`The live page ${live}. A change shows here after you publish it.`} />
        </section>
      </aside>
    </div>
  );
}
