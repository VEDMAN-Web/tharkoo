"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Notice } from "@/components/admin/ui";
import { saveHomeSelectionAction, searchHomeAdsAction } from "./home-actions";
import type { HomeSelectionRow } from "@/server/listings/home-selection";

type Message = { kind: "info" | "error"; text: string };
type Edit = { show: boolean; order: number };

const SHOWN_ON_HOME = 8;
const MAX_ORDER = 9999;

function Thumb({ src }: { src: string | null }) {
  return (
    <span
      aria-hidden
      data-tk="home-thumb"
      style={{
        width: 48,
        height: 48,
        borderRadius: 8,
        display: "block",
        background: src ? `center 18% / cover no-repeat url("${src}")` : "var(--border)",
      }}
    />
  );
}

function AdRow({ row, edit, onChange }: { row: HomeSelectionRow; edit: Edit; onChange: (next: Edit) => void }) {
  const inputId = `home-order-${row.id}`;
  return (
    <tr style={{ borderTop: "1px solid var(--border)" }} data-tk="home-row">
      <td style={{ padding: "6px 8px 6px 0", width: 56 }}>
        <Thumb src={row.thumb} />
      </td>
      <td>
        <strong>{row.title}</strong>
        <div className="t-small text-muted">{[row.city, row.category, row.status].filter(Boolean).join(" · ")}</div>
      </td>
      <td>
        <label>
          <input type="checkbox" checked={edit.show} onChange={(event) => onChange({ ...edit, show: event.target.checked })} /> Show on Home
        </label>
      </td>
      <td>
        <label className="adm-field-label" htmlFor={inputId} style={{ position: "absolute", left: -9999 }}>
          Order for {row.title}
        </label>
        <input
          id={inputId}
          className="adm-input"
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_ORDER}
          step={1}
          value={edit.order}
          style={{ width: 90 }}
          onChange={(event) => onChange({ ...edit, order: Number(event.target.value) })}
        />
      </td>
    </tr>
  );
}

function Table({ rows, edits, onChange }: { rows: HomeSelectionRow[]; edits: Map<string, Edit>; onChange: (id: string, next: Edit) => void }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="t-small" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left" }}>
            <th scope="col">Photo</th>
            <th scope="col">Ad</th>
            <th scope="col">Home</th>
            <th scope="col">Order</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <AdRow key={row.id} row={row} edit={edits.get(row.id) ?? { show: row.show, order: row.order }} onChange={(next) => onChange(row.id, next)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HomeSelection({ pinned, results }: { pinned: HomeSelectionRow[]; results: HomeSelectionRow[] }) {
  const [known, setKnown] = useState(() => new Map<string, HomeSelectionRow>([...pinned, ...results].map((row) => [row.id, row])));
  const [baseline, setBaseline] = useState(() => new Map<string, Edit>([...pinned, ...results].map((row) => [row.id, { show: row.show, order: row.order }])));
  const [edits, setEdits] = useState(() => new Map<string, Edit>(baseline));
  const [shown, setShown] = useState(results);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const dirty = useMemo(
    () =>
      [...edits].filter(([id, edit]) => {
        const old = baseline.get(id);
        return !old || old.show !== edit.show || old.order !== edit.order;
      }),
    [edits, baseline],
  );

  const chosen = useMemo(
    () =>
      [...edits]
        .filter(([, edit]) => edit.show)
        .sort((a, b) => a[1].order - b[1].order)
        .map(([id]) => known.get(id))
        .filter((row): row is HomeSelectionRow => Boolean(row)),
    [edits, known],
  );
  const chosenIds = new Set(chosen.map((row) => row.id));
  const visibleResults = shown.filter((row) => !chosenIds.has(row.id));

  function change(id: string, next: Edit) {
    setEdits((current) => new Map(current).set(id, next));
  }

  async function search(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const res = await searchHomeAdsAction(query);
    setBusy(false);
    if (!res.ok) return setMessage({ kind: "error", text: res.message });
    setKnown((current) => {
      const next = new Map(current);
      for (const row of res.results) if (!next.has(row.id)) next.set(row.id, row);
      return next;
    });
    setBaseline((current) => {
      const next = new Map(current);
      for (const row of res.results) if (!next.has(row.id)) next.set(row.id, { show: row.show, order: row.order });
      return next;
    });
    setEdits((current) => {
      const next = new Map(current);
      for (const row of res.results) if (!next.has(row.id)) next.set(row.id, { show: row.show, order: row.order });
      return next;
    });
    setShown(res.results);
    setMessage({ kind: "info", text: res.results.length ? `${res.results.length} ads found.` : "No ads found." });
  }

  async function save() {
    if (dirty.some(([, edit]) => !Number.isInteger(edit.order) || edit.order < 0 || edit.order > MAX_ORDER)) {
      return setMessage({ kind: "error", text: "Order must be a whole number from 0 to 9999." });
    }
    setBusy(true);
    setMessage(null);
    const res = await saveHomeSelectionAction(dirty.map(([listingId, edit]) => ({ listingId, show: edit.show, order: edit.order })));
    setBusy(false);
    if (!res.ok) return setMessage({ kind: "error", text: res.message });
    setBaseline((current) => {
      const next = new Map(current);
      for (const [id, edit] of dirty) next.set(id, { ...edit });
      return next;
    });
    setMessage({ kind: "info", text: `Saved. ${res.changed} ${res.changed === 1 ? "ad" : "ads"} changed.` });
  }

  return (
    <section className="adm-card" aria-labelledby="home-selection-heading" style={{ marginBottom: 16 }} data-tk="home-selection">
      <h2 id="home-selection-heading" className="t-h4">Ads on the Home page</h2>
      <p className="t-small text-muted">
        Search for an ad, tick Show on Home, set the order (lowest first) and press Save once. The row holds {SHOWN_ON_HOME} ads: the chosen ones first, then the newest ads.
      </p>
      <h3 className="t-h4" data-tk="home-pinned">
        On the Home page now ({chosen.length} of {SHOWN_ON_HOME})
      </h3>
      {chosen.length === 0 ? <p className="t-small text-muted">No ads chosen. Home shows the newest ads.</p> : <Table rows={chosen} edits={edits} onChange={change} />}
      <form role="search" onSubmit={search} style={{ display: "flex", gap: 8, margin: "16px 0 8px", flexWrap: "wrap" }}>
        <label className="adm-field-label" htmlFor="home-search" style={{ position: "absolute", left: -9999 }}>
          Search ads by title, city or category
        </label>
        <input id="home-search" className="adm-input" type="search" value={query} placeholder="Search by title, city or category" style={{ minWidth: 280, flex: "1 1 280px" }} onChange={(event) => setQuery(event.target.value)} />
        <button type="submit" className="adm-btn" disabled={busy}>
          Search
        </button>
      </form>
      {visibleResults.length === 0 ? <p className="t-small text-muted">No more ads to show here.</p> : <Table rows={visibleResults} edits={edits} onChange={change} />}
      <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
        <button type="button" className="adm-btn" disabled={busy || dirty.length === 0} onClick={save} data-tk="home-save">
          {busy ? "Saving" : "Save changes"}
        </button>
        <span className="t-small text-muted">{dirty.length === 0 ? "Nothing to save." : `${dirty.length} ${dirty.length === 1 ? "change" : "changes"} not saved yet.`}</span>
      </div>
      {message ? (
        <div style={{ marginTop: 12 }}>
          <Notice kind={message.kind === "error" ? "error" : "info"}>{message.text}</Notice>
        </div>
      ) : null}
    </section>
  );
}
