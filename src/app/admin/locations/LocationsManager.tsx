"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminList } from "@/app/admin/actions";
import { ConfirmDialog, Notice, Toggle } from "@/components/admin/ui";
import { createPlaceAction, deletePlaceAction, updatePlaceAction } from "@/server/locations/admin-actions";
import { flagFromCode } from "@/server/locations/flag";

type Level = "country" | "state" | "city";
type Row = { _id: string; type: string; slug: string; name: string; parentId?: string | null; enabled?: boolean; order?: number; countryCode?: string };
type Draft = { name: string; slug: string; countryCode: string; order: string; enabled: boolean };

const LEVELS: { type: Level; label: string; parent: Level | null }[] = [
  { type: "country", label: "Countries", parent: null },
  { type: "state", label: "States", parent: "country" },
  { type: "city", label: "Cities", parent: "state" },
];

const EMPTY: Draft = { name: "", slug: "", countryCode: "", order: "0", enabled: true };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, alignItems: "end" } as const;

function toDraft(row: Row): Draft {
  return { name: row.name, slug: row.slug, countryCode: row.countryCode ?? "", order: String(row.order ?? 0), enabled: row.enabled !== false };
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (next: string) => void }) {
  return (
    <label className="adm-field">
      <span className="adm-field-label">{label}</span>
      <input className="adm-input" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export function LocationsManager() {
  const [rows, setRows] = useState<Row[]>([]);
  const [level, setLevel] = useState<Level>("country");
  const [parent, setParent] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [fresh, setFresh] = useState<Draft>(EMPTY);
  const [note, setNote] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const [removing, setRemoving] = useState<Row | null>(null);

  const load = useCallback(async () => {
    try {
      const data = (await adminList("Location", 200)) as unknown as Row[];
      setRows(data);
      setDrafts(Object.fromEntries(data.map((row) => [row._id, toDraft(row)])));
    } catch (error) {
      setNote({ kind: "error", text: error instanceof Error ? error.message : "Could not load places" });
    }
  }, []);

  useEffect(() => {
    // Loading synchronizes the screen with the database once on open.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const def = LEVELS.find((item) => item.type === level)!;
  const parents = useMemo(() => rows.filter((row) => row.type === def.parent).sort((a, b) => a.name.localeCompare(b.name)), [rows, def.parent]);
  const shown = useMemo(
    () =>
      rows
        .filter((row) => row.type === level && (!def.parent || !parent || String(row.parentId) === parent))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name)),
    [rows, level, parent, def.parent],
  );

  function say(result: { ok: boolean; message?: string }, ok: string) {
    setNote(result.ok ? { kind: "info", text: ok } : { kind: "error", text: result.message || "Save failed" });
    return result.ok;
  }

  async function add() {
    const result = await createPlaceAction({
      type: level,
      parentId: def.parent ? parent : null,
      name: fresh.name,
      slug: fresh.slug,
      countryCode: fresh.countryCode,
      order: Number(fresh.order),
      enabled: fresh.enabled,
    });
    if (say(result, "Added. Public pages pick this up right away.")) {
      setFresh(EMPTY);
      await load();
    }
  }

  async function save(row: Row) {
    const draft = drafts[row._id];
    const result = await updatePlaceAction(row._id, {
      name: draft.name,
      slug: draft.slug,
      countryCode: draft.countryCode,
      order: Number(draft.order),
      enabled: draft.enabled,
    });
    if (say(result, "Saved. If the slug changed, the old address redirects to the new one.")) await load();
  }

  async function remove(row: Row) {
    setRemoving(null);
    const result = await deletePlaceAction(row._id);
    if (say(result, "Removed.")) await load();
  }

  function patch(id: string, next: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...next } }));
  }

  return (
    <div className="adm-stack">
      <div role="tablist" aria-label="Place level" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {LEVELS.map((item) => (
          <button
            key={item.type}
            type="button"
            role="tab"
            aria-selected={level === item.type}
            className={`adm-btn ${level === item.type ? "" : "adm-btn-ghost"}`}
            onClick={() => {
              setLevel(item.type);
              setParent("");
              setNote(null);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      {note ? <Notice kind={note.kind}>{note.text}</Notice> : null}
      {def.parent ? (
        <label className="adm-field" style={{ maxWidth: 320 }}>
          <span className="adm-field-label">{def.parent === "country" ? "Country" : "State"}</span>
          <select className="adm-input" value={parent} onChange={(event) => setParent(event.target.value)}>
            <option value="">All</option>
            {parents.map((row) => (
              <option key={row._id} value={row._id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="adm-card">
        <h2 className="adm-field-label">Add a {level}</h2>
        <div style={gridStyle}>
          <Field label="Name" value={fresh.name} onChange={(name) => setFresh({ ...fresh, name })} />
          <Field label="Slug (optional)" value={fresh.slug} onChange={(slug) => setFresh({ ...fresh, slug })} />
          {level === "country" ? (
            <Field label={`Flag code ${flagFromCode(fresh.countryCode)}`} value={fresh.countryCode} onChange={(countryCode) => setFresh({ ...fresh, countryCode })} />
          ) : null}
          <Field label="Order" value={fresh.order} onChange={(order) => setFresh({ ...fresh, order })} />
          <button type="button" className="adm-btn" onClick={add} disabled={!fresh.name.trim() || (Boolean(def.parent) && !parent)}>
            Add
          </button>
        </div>
        {def.parent && !parent ? <p className="adm-field-help">Pick a {def.parent} above first.</p> : null}
      </div>
      {shown.length === 0 ? <p className="adm-field-help">Nothing here yet.</p> : null}
      {shown.map((row) => {
        const draft = drafts[row._id] ?? toDraft(row);
        return (
          <div className="adm-card" key={row._id} data-testid="place-row">
            <div style={gridStyle}>
              <Field label="Name" value={draft.name} onChange={(name) => patch(row._id, { name })} />
              <Field label="Slug" value={draft.slug} onChange={(slug) => patch(row._id, { slug })} />
              {level === "country" ? (
                <Field label={`Flag code ${flagFromCode(draft.countryCode)}`} value={draft.countryCode} onChange={(countryCode) => patch(row._id, { countryCode })} />
              ) : null}
              <Field label="Order" value={draft.order} onChange={(order) => patch(row._id, { order })} />
              <Toggle checked={draft.enabled} onChange={(enabled) => patch(row._id, { enabled })} label={draft.enabled ? "Shown" : "Hidden"} />
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="adm-btn" onClick={() => save(row)}>
                  Save
                </button>
                <button type="button" className="adm-btn adm-btn-danger" onClick={() => setRemoving(row)}>
                  Remove
                </button>
              </div>
            </div>
          </div>
        );
      })}
      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.name ?? ""}?`}
        body="Places with ads or places inside them cannot be removed. Hide them instead."
        confirmText={removing?.slug ?? ""}
        onConfirm={() => removing && remove(removing)}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
