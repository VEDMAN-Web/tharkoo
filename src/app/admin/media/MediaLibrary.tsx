"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/admin/ui/ConfirmDialog";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Notice } from "@/components/admin/ui/Notice";
import { Skeleton } from "@/components/admin/ui/Skeleton";
import { TextField } from "@/components/admin/ui/TextField";
import { deleteMediaAction, listMediaAction, updateMediaAction } from "./actions";
import { BatchUpload } from "./BatchUpload";

type Item = {
  id: string;
  url: string;
  alt: string;
  width: number;
  height: number;
  bytes: number;
  tags: string[];
  oversize: boolean;
  missingAlt: boolean;
  autoAlt: boolean;
  used: boolean;
};

const kb = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);

function Card({ item, onChanged, onDelete }: { item: Item; onChanged: () => void; onDelete: (item: Item) => void }) {
  const [alt, setAlt] = useState(item.alt);
  const [tags, setTags] = useState(item.tags.join(", "));
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const dirty = alt !== item.alt || tags !== item.tags.join(", ") || item.autoAlt;

  async function save() {
    setError("");
    setNote("");
    const res = await updateMediaAction(item.id, { alt, tags });
    if (!res.ok) return setError(res.error);
    setNote("Saved");
    onChanged();
  }

  return (
    <article className="adm-card" style={{ display: "grid", gap: 10, alignContent: "start" }}>
      <div style={{ background: "var(--adm-bg)", borderRadius: 12, overflow: "hidden", aspectRatio: "4 / 3", display: "grid", placeItems: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.url} alt={item.alt} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} loading="lazy" />
      </div>
      <p className="adm-field-help" style={{ margin: 0 }}>
        {item.width} × {item.height} · {kb(item.bytes)}
        {item.autoAlt ? " · Auto alt, check it" : item.missingAlt ? " · Missing alt" : ""}
        {item.oversize ? " · Oversize" : ""}
        {!item.used ? " · Unused" : ""}
      </p>
      <TextField label="Alt text" value={alt} onChange={setAlt} min={3} max={125} error={alt.trim().length < 3 ? "Alt text is required" : undefined} />
      <TextField label="Tags" value={tags} onChange={setTags} />
      {error ? <Notice kind="error">{error}</Notice> : null}
      {note ? <p className="adm-field-help">{note}</p> : null}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="adm-btn" disabled={!dirty || alt.trim().length < 3} onClick={save}>
          Save
        </button>
        <button type="button" className="adm-btn adm-btn-quiet" onClick={() => onDelete(item)}>
          Delete
        </button>
      </div>
    </article>
  );
}

export function MediaLibrary({ uploadsEnabled = true }: { uploadsEnabled?: boolean }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [missingAlt, setMissingAlt] = useState(false);
  const [oversize, setOversize] = useState(false);
  const [unused, setUnused] = useState(false);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<Item | null>(null);
  const [removeError, setRemoveError] = useState("");

  const load = useCallback(async () => {
    const res = await listMediaAction({ q, missingAlt, oversize, unused });
    if (!res.ok) {
      setError(res.error);
      setItems([]);
      return;
    }
    setError("");
    setItems(res.items as Item[]);
    setTotal(res.total);
  }, [q, missingAlt, oversize, unused]);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), q ? 250 : 0);
    return () => window.clearTimeout(id);
  }, [load, q]);

  async function confirmDelete() {
    if (!removing) return;
    const res = await deleteMediaAction(removing.id);
    if (!res.ok) {
      setRemoveError(res.error);
      setRemoving(null);
      return;
    }
    setRemoveError("");
    setRemoving(null);
    void load();
  }

  return (
    <div className="adm-stack">
      <BatchUpload enabled={uploadsEnabled} onDone={() => void load()} />
      <section className="adm-card" style={{ display: "grid", gap: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800 }}>Library{items ? ` (${total})` : ""}</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
          <input className="adm-input" style={{ maxWidth: 280 }} type="search" aria-label="Search images" placeholder="Search alt text or tags" value={q} onChange={(event) => setQ(event.target.value)} />
          <label className="adm-toggle">
            <input type="checkbox" checked={missingAlt} onChange={(event) => setMissingAlt(event.target.checked)} /> Images missing alt
          </label>
          <label className="adm-toggle">
            <input type="checkbox" checked={oversize} onChange={(event) => setOversize(event.target.checked)} /> Oversize (over 500 KB)
          </label>
          <label className="adm-toggle">
            <input type="checkbox" checked={unused} onChange={(event) => setUnused(event.target.checked)} /> Unused
          </label>
        </div>
        {error ? <Notice kind="error">{error}</Notice> : null}
        {removeError ? <Notice kind="warn" title="Not deleted">{removeError}</Notice> : null}
      </section>
      {items === null ? (
        <Skeleton lines={4} />
      ) : items.length === 0 && !error ? (
        <EmptyState title="No images yet" why="Upload an image above. Every image needs alt text before it can be saved." />
      ) : (
        <div className="adm-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {items.map((item) => (
            <Card key={`${item.id}-${item.alt}-${item.tags.join(",")}`} item={item} onChanged={() => void load()} onDelete={setRemoving} />
          ))}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(removing)}
        title="Delete this image?"
        body="The file is removed. If a page block still uses it, the delete is refused and you will see where."
        confirmText="delete"
        onCancel={() => setRemoving(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
