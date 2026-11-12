"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Notice, SerpPreview, TextField } from "@/components/admin/ui";
import { ImagePicker, type ImageRef } from "@/components/admin/ui/ImagePicker";
import {
  applyOverrideCsvAction,
  deleteOverrideAction,
  previewOverrideCsvAction,
  saveOverrideFieldsAction,
} from "./override-actions";
import { OVERRIDE_LIMITS, overridesToCsv, type OverrideClean } from "./override-rules";

const BLANK: OverrideClean = { path: "", title: "", description: "", h1: "", canonical: "", noindex: false, ogImage: "", intro: "", faq: [] };

type PreviewRow = { line: number; path: string; status: string; changes: string[]; errors: string[] };

export function OverridesPanel({ overrides, origin }: { overrides: OverrideClean[]; origin: string }) {
  const router = useRouter();
  const [form, setForm] = useState<OverrideClean>(BLANK);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState("");
  const [busy, start] = useTransition();
  const set = <K extends keyof OverrideClean>(key: K, value: OverrideClean[K]) => setForm((current) => ({ ...current, [key]: value }));
  const err = (name: string) => errors[name]?.[0];

  const image: ImageRef | null = form.ogImage ? { assetId: "", src: form.ogImage, alt: "Social share image", width: 0, height: 0 } : null;

  function save() {
    start(async () => {
      const out = await saveOverrideFieldsAction({ ...form });
      if (out.ok) {
        setErrors({});
        setMessage(`Saved ${out.path}`);
        router.refresh();
      } else {
        setErrors(out.fields);
        setMessage(out.message);
      }
    });
  }

  function remove(path: string) {
    if (!window.confirm(`Remove the SEO override for ${path}?`)) return;
    start(async () => {
      const out = await deleteOverrideAction(path);
      setMessage(out.ok ? `Removed ${path}` : out.message);
      if (out.ok) router.refresh();
    });
  }

  function downloadCsv() {
    const blob = new Blob([overridesToCsv(overrides)], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "seo-overrides.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="adm-stack">
      <section className="adm-card" style={{ display: "grid", gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>SEO for one page</h2>
        <p className="adm-field-help" style={{ margin: 0 }}>
          An override wins over the page-type and category templates. Leave a field empty to use the template text.
        </p>
        <TextField label="Page address" value={form.path} onChange={(next) => set("path", next)} placeholder="/jobs/pune/" error={err("path")} required />
        <TextField label="Title" value={form.title} onChange={(next) => set("title", next)} min={30} max={65} error={err("title")} />
        <TextField label="Description" value={form.description} onChange={(next) => set("description", next)} multiline min={70} max={160} error={err("description")} />
        <TextField label="H1 (main heading)" value={form.h1} onChange={(next) => set("h1", next)} max={OVERRIDE_LIMITS.h1} error={err("h1")} />
        <TextField label="Intro text" value={form.intro} onChange={(next) => set("intro", next)} multiline max={OVERRIDE_LIMITS.intro} error={err("intro")} />
        <TextField label="Canonical address" value={form.canonical} onChange={(next) => set("canonical", next)} placeholder="/jobs/" help="A path or a full address on this site." error={err("canonical")} />
        <label className="adm-field">
          <span className="adm-field-label">Search engines</span>
          <select className="adm-input" value={form.noindex ? "noindex" : "index"} onChange={(event) => set("noindex", event.target.value === "noindex")}>
            <option value="index">Allow indexing</option>
            <option value="noindex">Hide from search (noindex)</option>
          </select>
        </label>
        <ImagePicker label="Social share image" value={image} onChange={(next) => set("ogImage", next?.src ?? "")} />
        {err("ogImage") ? <p className="adm-field-error">{err("ogImage")}</p> : null}

        <div style={{ display: "grid", gap: 8 }}>
          <span className="adm-field-label">Questions and answers (up to {OVERRIDE_LIMITS.faqCount})</span>
          {form.faq.map((item, index) => (
            <div key={index} className="adm-card" style={{ display: "grid", gap: 8 }}>
              <TextField label={`Question ${index + 1}`} value={item.q} onChange={(next) => set("faq", form.faq.map((row, i) => (i === index ? { ...row, q: next } : row)))} max={OVERRIDE_LIMITS.faqQ} />
              <TextField label="Answer" value={item.a} onChange={(next) => set("faq", form.faq.map((row, i) => (i === index ? { ...row, a: next } : row)))} multiline max={OVERRIDE_LIMITS.faqA} />
              <div>
                <button type="button" className="adm-btn adm-btn-quiet" onClick={() => set("faq", form.faq.filter((_, i) => i !== index))}>
                  Remove question
                </button>
              </div>
            </div>
          ))}
          {err("faq") ? <p className="adm-field-error">{err("faq")}</p> : null}
          {form.faq.length < OVERRIDE_LIMITS.faqCount ? (
            <div>
              <button type="button" className="adm-btn adm-btn-quiet" onClick={() => set("faq", [...form.faq, { q: "", a: "" }])}>
                Add a question
              </button>
            </div>
          ) : null}
        </div>

        <SerpPreview title={form.title || "Title from the template"} description={form.description || "Description from the template"} url={`${origin.replace(/^https?:\/\//, "")}${form.path || "/"}`} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" className="adm-btn" onClick={save} disabled={busy || !form.path.trim()}>
            Save override
          </button>
          {message ? <span aria-live="polite">{message}</span> : null}
        </div>
      </section>

      <section className="adm-card" style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Pages with an override ({overrides.length})</h2>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={downloadCsv} disabled={!overrides.length}>
            Download CSV
          </button>
        </div>
        {overrides.length === 0 ? <p className="adm-field-help" style={{ margin: 0 }}>No overrides yet.</p> : null}
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
          {overrides.map((row) => (
            <li key={row.path} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ overflowWrap: "anywhere" }}>
                <strong>{row.path}</strong>
                {row.noindex ? " (noindex)" : ""}
                {row.title ? ` - ${row.title}` : ""}
              </span>
              <span style={{ display: "flex", gap: 8 }}>
                <button type="button" className="adm-btn adm-btn-quiet" onClick={() => { setForm(row); setErrors({}); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                  Edit
                </button>
                <button type="button" className="adm-btn adm-btn-quiet" onClick={() => remove(row.path)} disabled={busy}>
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <CsvImport onDone={() => router.refresh()} />
    </div>
  );
}

function CsvImport({ onDone }: { onDone: () => void }) {
  const [csv, setCsv] = useState("");
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, start] = useTransition();
  const file = useRef<HTMLInputElement>(null);

  const hasErrors = Boolean(rows?.some((row) => row.status === "error")) || problems.length > 0;
  const changes = rows?.filter((row) => row.status === "new" || row.status === "changed").length ?? 0;

  function preview() {
    start(async () => {
      setMessage("");
      const out = await previewOverrideCsvAction(csv);
      if (out.ok) {
        setRows(out.rows);
        setProblems(out.fileErrors);
      } else {
        setRows(null);
        setProblems([out.message]);
      }
    });
  }

  function apply() {
    start(async () => {
      const out = await applyOverrideCsvAction(csv);
      if (out.ok) {
        setMessage(`Imported ${out.applied} page${out.applied === 1 ? "" : "s"}; ${out.unchanged} unchanged.`);
        setRows(null);
        setCsv("");
        onDone();
      } else {
        setMessage(out.message);
      }
    });
  }

  return (
    <section className="adm-card" style={{ display: "grid", gap: 10 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>Bulk import (CSV)</h2>
      <p className="adm-field-help" style={{ margin: 0 }}>
        Columns: path, title, description, h1, robots (index or noindex). Only the columns in your file are changed; an empty cell clears that field. You see the changes before anything is saved.
      </p>
      <input
        ref={file}
        type="file"
        accept=".csv,text/csv"
        onChange={async (event) => {
          const picked = event.target.files?.[0];
          if (picked) {
            setCsv(await picked.text());
            setRows(null);
          }
        }}
      />
      <TextField label="Or paste the CSV here" value={csv} onChange={(next) => { setCsv(next); setRows(null); }} multiline />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="adm-btn adm-btn-ghost" onClick={preview} disabled={busy || !csv.trim()}>
          Check the file (dry run)
        </button>
        <button type="button" className="adm-btn" onClick={apply} disabled={busy || !rows || hasErrors || changes === 0}>
          Apply {changes} change{changes === 1 ? "" : "s"}
        </button>
      </div>
      {problems.map((text) => (
        <Notice key={text} kind="error">{text}</Notice>
      ))}
      {message ? <Notice kind="info">{message}</Notice> : null}
      {rows ? (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Line</th>
                <th>Path</th>
                <th>Result</th>
                <th>What changes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.line}-${row.path}`}>
                  <td>{row.line}</td>
                  <td style={{ overflowWrap: "anywhere" }}>{row.path}</td>
                  <td>{row.status}</td>
                  <td>{row.status === "error" ? row.errors.join("; ") : row.changes.join("; ") || "nothing"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
