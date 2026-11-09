"use client";

import { useEffect, useState } from "react";

export function CollectionEditor({
  model,
  title,
  createTemplate,
  summary,
}: {
  model: string;
  title?: string;
  createTemplate?: Record<string, unknown>;
  summary?: (row: Record<string, unknown>) => string;
}) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [edit, setEdit] = useState<Record<string, unknown> | null>(null);
  const [json, setJson] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    const res = await fetch(`/api/admin/list?model=${model}`);
    const data = await res.json();
    if (!res.ok) setErr(data.error || "Load failed");
    setRows(data.items || []);
  }

  useEffect(() => {
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
      const res = await fetch("/api/admin/mutate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, op: "update", id, data }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error);
      setMsg("Saved. Public pages pick this up immediately.");
      setEdit(null);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function create() {
    const res = await fetch("/api/admin/mutate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, op: "create", data: createTemplate || { status: "active" } }),
    });
    const out = await res.json();
    if (out.item) open(out.item);
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this record?")) return;
    await fetch("/api/admin/mutate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, op: "delete", id }),
    });
    setEdit(null);
    await load();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-bold">{title || model}</h2>
          <button type="button" className="btn-post" onClick={create}>
            New
          </button>
        </div>
        {err ? <p className="text-[13px] text-[#e20044]">{err}</p> : null}
        {!rows.length ? <p className="text-[13px] text-[#777]">No records yet.</p> : null}
        <ul className="max-h-[70vh] overflow-auto text-[13px]">
          {rows.map((row) => (
            <li key={String(row._id)}>
              <button type="button" className="w-full border-b px-1 py-2 text-left hover:bg-[#f5f5f5]" onClick={() => open(row)}>
                {summary ? summary(row) : String(row.name || row.title || row.slug || row.key || row.code || row._id)}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-white p-3">
        {edit ? (
          <>
            <p className="mb-2 text-[12px] text-[#777]">JSON editor — every field is live on the site after Save.</p>
            <textarea value={json} onChange={(e) => setJson(e.target.value)} rows={22} className="w-full border font-mono text-[12px]" />
            <div className="mt-2 flex gap-2">
              <button type="button" className="btn-post" onClick={save}>
                Save
              </button>
              <button type="button" className="btn-ghost" onClick={() => setEdit(null)}>
                Cancel
              </button>
              <button type="button" className="text-[13px] text-[#e20044]" onClick={() => remove(String(edit._id))}>
                Delete
              </button>
            </div>
            {msg ? <p className="mt-2 text-[13px] text-[var(--sk-verified)]">{msg}</p> : null}
          </>
        ) : (
          <p className="text-[13px] text-[#777]">Select a record or create one. Saving writes Mongo and refreshes the public site.</p>
        )}
      </div>
    </div>
  );
}
