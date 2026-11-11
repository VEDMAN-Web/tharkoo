"use client";

import { useEffect, useState } from "react";
import { adminList, adminMutate } from "@/app/admin/actions";

export function CollectionEditor({
  model,
  title,
  createTemplate,
  summaryFields = [],
  filters = [],
  allowCreate = true,
}: {
  model: string;
  title?: string;
  createTemplate?: Record<string, unknown>;
  summaryFields?: string[];
  filters?: { label: string; field: string; value: string }[];
  allowCreate?: boolean;
}) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [edit, setEdit] = useState<Record<string, unknown> | null>(null);
  const [json, setJson] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("all");

  async function load() {
    setErr("");
    try {
      setRows(await adminList(model));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Load failed");
    }
  }

  useEffect(() => {
    // Loading intentionally synchronizes the editor with the selected model.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [model]);

  function open(row: Record<string, unknown>) {
    setEdit(row);
    const copy = { ...row };
    delete copy.__v;
    setJson(JSON.stringify(copy, null, 2));
    setMsg("");
  }

  async function save() {
    if (!edit) return;
    try {
      const data = JSON.parse(json);
      const id = String(data._id || edit._id);
      delete data._id;
      await adminMutate({ model, op: "update", id, data });
      setMsg("Saved. Public pages pick this up immediately.");
      setEdit(null);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function create() {
    const out = await adminMutate({ model, op: "create", data: createTemplate || { status: "active" } });
    if (out.item) open(out.item);
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this record?")) return;
    await adminMutate({ model, op: "delete", id });
    setEdit(null);
    await load();
  }

  const shown = rows.filter((row) => {
    if (filter === "all") return true;
    const chosen = filters.find((item) => `${item.field}:${item.value}` === filter);
    return chosen ? String(row[chosen.field] ?? "") === chosen.value : true;
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border border-line bg-surface p-3 text-text">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="font-bold">{title || model}</h2>
          {allowCreate ? (
            <button type="button" className="tk-btn tk-btn-rose shrink-0" style={{ position: "static" }} onClick={create}>
              New
            </button>
          ) : null}
        </div>
        {filters.length ? (
          <div className="mb-3 flex flex-wrap gap-2" data-tk="admin-filters">
            <button type="button" className="tk-pill" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All</button>
            {filters.map((item) => {
              const id = `${item.field}:${item.value}`;
              return (
                <button key={id} type="button" className="tk-pill" aria-pressed={filter === id} onClick={() => setFilter(id)}>
                  {item.label}
                </button>
              );
            })}
          </div>
        ) : null}
        {err ? <p className="t-small text-danger">{err}</p> : null}
        {!shown.length ? <p className="t-small text-muted">No records yet.</p> : null}
        <ul className="max-h-[70vh] overflow-auto t-small">
          {shown.map((row) => (
            <li key={String(row._id)}>
              <button type="button" className="w-full border-b border-line px-1 py-2 text-left hover:bg-surface-2" onClick={() => open(row)}>
                {summaryFields.length
                  ? summaryFields.map((field) => row[field]).filter((value) => value !== undefined && value !== null && value !== "").join(" · ") || String(row._id)
                  : String(row.name || row.title || row.slug || row.key || row.code || row._id)}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-lg border border-line bg-surface p-3 text-text">
        {edit ? (
          <>
            <p className="mb-2 t-caption text-muted">JSON editor — every field is live on the site after Save.</p>
            <textarea value={json} onChange={(e) => setJson(e.target.value)} rows={22} className="w-full rounded-md border border-line bg-bg p-2 font-mono text-[12px] text-text" />
            <div className="mt-2 flex gap-2">
              <button type="button" className="tk-btn tk-btn-rose" onClick={save}>
                Save
              </button>
              <button type="button" className="tk-btn tk-btn-outline-rose" onClick={() => setEdit(null)}>
                Cancel
              </button>
              <button type="button" className="t-small text-danger" onClick={() => remove(String(edit._id))}>
                Delete
              </button>
            </div>
            {msg ? <p className="mt-2 t-small text-[var(--success)]">{msg}</p> : null}
          </>
        ) : (
          <p className="t-small text-muted">Select a record or create one. Saving writes Mongo and refreshes the public site.</p>
        )}
      </div>
    </div>
  );
}
