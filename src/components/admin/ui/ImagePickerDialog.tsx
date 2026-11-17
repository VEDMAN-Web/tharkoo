"use client";

import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import "@/styles/admin-kit.css";
import "@/styles/admin-picker.css";
import { listMediaAction } from "@/app/admin/media/actions";
import { fileProblem, fileSize, type UploadRule } from "@/components/upload/rules";
import type { ImageRef } from "./ImagePicker";
import { Tabs } from "./Tabs";
import { TextField } from "./TextField";

export type PickerRow = { id: string; url: string; alt: string; width: number; height: number; used?: boolean };
export type PickerTab = "library" | "upload";

const MB = 1024 * 1024;
const FOCUSABLE = "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])";
const DEFAULT_RULE: UploadRule = {
  noun: "image",
  accept: ["image/jpeg", "image/png", "image/webp"],
  formats: "JPG, PNG or WEBP",
  maxBytes: 8 * MB,
  line: "JPG, PNG or WEBP, up to 8 MB.",
  details: [],
};
const TABS = [
  { key: "library", label: "Library" },
  { key: "upload", label: "Upload new" },
];

/**
 * The picture pop-up (H7.162): a sticky top (title, tabs, search) over a scrolling body. Library tiles are plain
 * buttons with a 3:2 thumbnail, the description on one line and a Used or Not used hint. The Upload tab has a real drop zone,
 * a preview of the chosen file, the size rule and a description box. Esc closes it, Tab stays inside and focus goes back to the button.
 */
export function ImagePickerDialog({
  label,
  value,
  rule,
  startTab,
  onPick,
  onClose,
}: {
  label: string;
  value?: ImageRef | null;
  rule?: UploadRule;
  startTab: PickerTab;
  onPick: (row: PickerRow) => void;
  onClose: () => void;
}) {
  const uid = useId();
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const [tab, setTab] = useState<PickerTab>(startTab);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<PickerRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>("input[type=search], [role=tab][aria-selected=true]");
    first?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel.current) return;
      const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((node) => node.getClientRects().length > 0);
      if (items.length === 0) return;
      const head = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!panel.current.contains(active)) {
        event.preventDefault();
        head.focus();
      } else if (event.shiftKey && active === head) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        head.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      previous?.focus?.();
    };
  }, []);

  useEffect(() => {
    if (tab !== "library") return;
    let live = true;
    const id = window.setTimeout(async () => {
      const res = await listMediaAction({ q, limit: 60 });
      if (!live) return;
      if (!res.ok) {
        setError(res.error);
        setRows([]);
      } else {
        setError("");
        setRows(res.items);
      }
    }, q ? 250 : 0);
    return () => {
      live = false;
      window.clearTimeout(id);
    };
  }, [tab, q]);

  return (
    <div className="adm-dialog-back adm-pk-back" onMouseDown={(event) => event.target === event.currentTarget && onClose()} data-tk="picker-back">
      <div ref={panel} className="adm-k adm-pk" role="dialog" aria-modal="true" aria-labelledby={`${uid}-title`} data-tk="picker">
        <div className="adm-pk-top">
          <div className="adm-pk-head">
            <h2 id={`${uid}-title`} className="adm-pk-title">Choose a picture for: {label}</h2>
            <button type="button" className="adm-k-btn adm-k-btn-quiet adm-k-btn-sm" onClick={onClose}>
              Close
            </button>
          </div>
          <Tabs items={TABS} active={tab} onChange={(key) => { setTab(key as PickerTab); setError(""); }} label="Picture source" idPrefix={`${uid}-tab`} />
          {tab === "library" ? (
            <input className="adm-input adm-pk-search" type="search" aria-label="Search images" placeholder="Search by description or tag" value={q} onChange={(event) => setQ(event.target.value)} />
          ) : null}
        </div>
        <div className="adm-pk-body" role="tabpanel" id={`${uid}-tab-panel-${tab}`} aria-labelledby={`${uid}-tab-${tab}`}>
          {error ? <p className="adm-field-error" role="alert">{error}</p> : null}
          {tab === "library" ? <Library rows={rows} selected={value} onPick={onPick} /> : <UploadTab rule={rule ?? DEFAULT_RULE} onPick={onPick} onError={setError} />}
        </div>
      </div>
    </div>
  );
}

function Library({ rows, selected, onPick }: { rows: PickerRow[] | null; selected?: ImageRef | null; onPick: (row: PickerRow) => void }) {
  if (rows === null) return <p className="adm-field-help" role="status">Loading pictures...</p>;
  if (rows.length === 0) return <p className="adm-field-help" role="status">No pictures found. Use the Upload new tab.</p>;
  return (
    <div className="adm-pk-grid" data-tk="picker-grid">
      {rows.map((row) => (
        <button key={row.id} type="button" className="adm-pk-tile" aria-pressed={Boolean(selected) && (row.id === selected?.assetId || row.url === selected?.src)} title={row.alt} onClick={() => onPick(row)}>
          <span className="adm-pk-thumb">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={row.url} alt="" loading="lazy" />
          </span>
          <span className="adm-pk-desc">{row.alt}</span>
          <span className={`adm-pk-used${row.used ? " is-used" : ""}`}>{row.used ? "Used" : "Not used"}</span>
        </button>
      ))}
    </div>
  );
}

function UploadTab({ rule, onPick, onError }: { rule: UploadRule; onPick: (row: PickerRow) => void; onError: (message: string) => void }) {
  const uid = useId();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [alt, setAlt] = useState("");
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [problem, setProblem] = useState("");

  const previewUrl = useRef("");

  useEffect(() => () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
  }, []);

  function choose(next: File | null) {
    onError("");
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = next ? URL.createObjectURL(next) : "";
    setPreview(previewUrl.current);
    setFile(next);
    setProblem(next ? (fileProblem(next, rule) ?? "") : "");
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setOver(false);
    choose(event.dataTransfer.files?.[0] ?? null);
  }

  async function upload() {
    if (!file || problem) return;
    setBusy(true);
    onError("");
    const form = new FormData();
    form.set("file", file);
    form.set("alt", alt);
    try {
      const res = await fetch("/admin/media/upload/", { method: "POST", body: form });
      const body = (await res.json()) as { ok: boolean; error?: string; item?: PickerRow };
      if (!body.ok || !body.item) onError(body.error || "Upload failed");
      else onPick(body.item);
    } catch {
      onError("Upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="adm-pk-upload" data-tk="picker-upload">
      <label className={`adm-pk-drop${over ? " is-over" : ""}${file ? " has-file" : ""}`} onDragOver={(event) => { event.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
        <input className="adm-pk-file" type="file" accept={rule.accept.join(",")} aria-describedby={`${uid}-rule`} onChange={(event) => choose(event.target.files?.[0] ?? null)} />
        <strong>Drag a picture here, or click to choose</strong>
        <span>{file ? "Choose a different file" : rule.formats}</span>
      </label>
      <p className="adm-field-help" id={`${uid}-rule`} data-tk="picker-rule">{rule.line}</p>
      {file ? (
        <div className="adm-pk-chosen" data-tk="picker-chosen">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview ? <img src={preview} alt="Preview of the chosen picture" /> : null}
          <div>
            <strong className="adm-pk-name">{file.name}</strong>
            <span>{fileSize(file.size)}</span>
          </div>
        </div>
      ) : null}
      {problem ? <p className="adm-field-error" role="alert">{problem}</p> : null}
      <TextField label="Describe the picture" value={alt} onChange={setAlt} min={3} max={125} required placeholder="For example: A bright living room with a green sofa" help="Say what the picture shows, for people who cannot see it." />
      <div className="adm-dialog-actions">
        <button type="button" className="adm-k-btn adm-k-btn-primary" disabled={busy || !file || Boolean(problem) || alt.trim().length < 3} onClick={upload}>
          {busy ? "Uploading..." : "Upload and use"}
        </button>
      </div>
    </div>
  );
}
