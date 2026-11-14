"use client";

import { useEffect, useState } from "react";
import { listMediaAction } from "@/app/admin/media/actions";
import { TextField } from "./TextField";

/** The shape blocks store for an image (see `image` in src/server/layout/blocks.ts). */
export interface ImageRef {
  assetId: string;
  src: string;
  alt: string;
  width: number;
  height: number;
}

type Row = { id: string; url: string; alt: string; width: number; height: number };

const toRef = (row: Row): ImageRef => ({ assetId: row.id, src: row.url, alt: row.alt, width: row.width, height: row.height });

/**
 * Chooses an image from the media library or uploads a new one (alt text is required).
 * Block editors use it for every image field. `banner` (H6.13) names the buttons for a hero banner:
 * choose / replace from the library, upload a new banner, remove the banner.
 */
export function ImagePicker({ label, value, onChange, banner = false }: { label: string; value?: ImageRef | null; onChange: (next: ImageRef | null) => void; banner?: boolean }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"library" | "upload">("library");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || tab !== "library") return;
    const id = window.setTimeout(async () => {
      const res = await listMediaAction({ q, limit: 60 });
      if (!res.ok) {
        setError(res.error);
        setRows([]);
      } else {
        setError("");
        setRows(res.items);
      }
    }, q ? 250 : 0);
    return () => window.clearTimeout(id);
  }, [open, tab, q]);

  function pick(row: Row) {
    onChange(toRef(row));
    setOpen(false);
  }

  function openAt(next: "library" | "upload") {
    setTab(next);
    setOpen(true);
  }

  async function upload() {
    if (!file) return;
    setBusy(true);
    setError("");
    const form = new FormData();
    form.set("file", file);
    form.set("alt", alt);
    try {
      const res = await fetch("/admin/media/upload/", { method: "POST", body: form });
      const body = (await res.json()) as { ok: boolean; error?: string; item?: Row };
      if (!body.ok || !body.item) setError(body.error || "Upload failed");
      else {
        setFile(null);
        setAlt("");
        pick(body.item);
      }
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="adm-field">
      <span className="adm-field-label">{label}</span>
      {value ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value.src} alt={value.alt} width={72} height={54} style={{ objectFit: "cover", borderRadius: 8 }} />
          <span className="adm-field-help" style={{ flex: 1 }}>{value.alt}</span>
          {banner ? null : (
            <button type="button" className="adm-btn adm-btn-quiet" onClick={() => onChange(null)}>
              Remove
            </button>
          )}
        </div>
      ) : null}
      {banner ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={() => openAt("library")}>
            {value ? "Replace" : "Choose from media library"}
          </button>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={() => openAt("upload")}>
            Upload new banner
          </button>
          {value ? (
            <button type="button" className="adm-btn adm-btn-quiet" onClick={() => onChange(null)}>
              Remove banner
            </button>
          ) : null}
        </div>
      ) : (
        <div>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setOpen(true)}>
            {value ? "Change image" : "Choose image"}
          </button>
        </div>
      )}
      {open ? (
        <div className="adm-dialog-back" onClick={() => setOpen(false)}>
          <div className="adm-dialog" role="dialog" aria-modal="true" aria-label={label} style={{ width: "min(720px, 100%)" }} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className={`adm-btn ${tab === "library" ? "" : "adm-btn-quiet"}`} onClick={() => setTab("library")}>
                Library
              </button>
              <button type="button" className={`adm-btn ${tab === "upload" ? "" : "adm-btn-quiet"}`} onClick={() => setTab("upload")}>
                Upload new
              </button>
              <span style={{ flex: 1 }} />
              <button type="button" className="adm-btn adm-btn-quiet" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            {error ? <p className="adm-field-error">{error}</p> : null}
            {tab === "library" ? (
              <>
                <input className="adm-input" type="search" aria-label="Search images" placeholder="Search alt text or tags" value={q} onChange={(event) => setQ(event.target.value)} />
                <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", maxHeight: 360, overflowY: "auto" }}>
                  {(rows ?? []).map((row) => (
                    <button key={row.id} type="button" className="adm-btn adm-btn-quiet" style={{ display: "grid", padding: 6, minHeight: 0 }} onClick={() => pick(row)} title={row.alt}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={row.url} alt={row.alt} style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: 8 }} loading="lazy" />
                    </button>
                  ))}
                  {rows && rows.length === 0 ? <p className="adm-field-help">No images found. Use the Upload new tab.</p> : null}
                </div>
              </>
            ) : (
              <>
                <input className="adm-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
                <TextField label="Alt text" value={alt} onChange={setAlt} min={3} max={125} required />
                <div className="adm-dialog-actions">
                  <button type="button" className="adm-btn" disabled={busy || !file || alt.trim().length < 3} onClick={upload}>
                    {busy ? "Uploading…" : "Upload and use"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
