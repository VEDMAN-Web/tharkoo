"use client";

import Link from "next/link";
import { useState } from "react";
import { DataTable, type Column } from "@/components/admin/ui";
import { explainUrlAction } from "../actions";

export interface PageRow {
  path: string;
  type: string;
  status: number;
  inSitemap: boolean;
  indexable: boolean;
  title: string;
  desc: string;
  h1: string;
  canonical: string;
  words: number;
  schema: string;
  issues: string[];
}

const EDITORS: Record<string, string> = {
  home: "/admin/homepage/",
  category: "/admin/seo/templates/",
  city: "/admin/seo/templates/",
  district: "/admin/seo/templates/",
};

const columns: Column<PageRow>[] = [
  {
    key: "path",
    label: "Path",
    sortable: true,
    render: (row) => (
      <Link href={EDITORS[row.type] ?? "/admin/urls/"} className="adm-link" title="Open the editor for this page">
        {row.path}
      </Link>
    ),
  },
  { key: "type", label: "Type", sortable: true },
  { key: "status", label: "Status", sortable: true },
  { key: "indexable", label: "Indexable", sortable: true, value: (row) => (row.indexable ? "yes" : "no") },
  { key: "title", label: "Title", sortable: true, render: (row) => `${row.title} (${row.title.length})`, value: (row) => row.title },
  { key: "desc", label: "Description", render: (row) => `${row.desc.length} chars`, value: (row) => row.desc },
  { key: "h1", label: "H1" },
  { key: "canonical", label: "Canonical" },
  { key: "words", label: "Words", sortable: true },
  { key: "schema", label: "Schema" },
  { key: "issues", label: "Issues", value: (row) => row.issues.join("; "), render: (row) => (row.issues.length ? row.issues.join("; ") : "none") },
];

const TYPES = ["all", "home", "category", "city", "district", "tag", "ad", "search", "other"];

export function PagesTable({ rows }: { rows: PageRow[] }) {
  const [type, setType] = useState("all");
  const [issueOnly, setIssueOnly] = useState(false);
  const shown = rows.filter((row) => (type === "all" || row.type === type) && (!issueOnly || row.issues.length > 0));
  return (
    <div className="adm-stack">
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <label className="adm-field" style={{ minWidth: 180 }}>
          <span className="adm-field-label">Page type</span>
          <select className="adm-input" value={type} onChange={(event) => setType(event.target.value)}>
            {TYPES.map((item) => (
              <option key={item} value={item}>
                {item === "all" ? "All types" : item}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44 }}>
          <input type="checkbox" checked={issueOnly} onChange={(event) => setIssueOnly(event.target.checked)} />
          <span>Only pages with issues</span>
        </label>
      </div>
      <DataTable columns={columns} rows={shown} rowKey={(row) => row.path} csvName="seo-pages" emptyText="No pages in the last check" />
      <WhyBox />
    </div>
  );
}

function WhyBox() {
  const [url, setUrl] = useState("");
  const [answer, setAnswer] = useState<{ indexable: boolean; reasons: string[]; href: string; label: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask() {
    setBusy(true);
    setError("");
    setAnswer(null);
    const out = await explainUrlAction(url);
    setBusy(false);
    if (out.ok) setAnswer({ indexable: out.indexable, reasons: out.reasons, href: out.editor.href, label: out.editor.label });
    else setError(out.message);
  }

  return (
    <section className="adm-card" style={{ display: "grid", gap: 10 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>Why is this URL indexable or not?</h2>
      <label className="adm-field">
        <span className="adm-field-label">Page address</span>
        <input className="adm-input" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="/jobs/pune/" />
      </label>
      <div>
        <button type="button" className="adm-btn" onClick={ask} disabled={busy || !url.trim()}>
          {busy ? "Checking..." : "Explain"}
        </button>
      </div>
      {error ? <p className="adm-field-error">{error}</p> : null}
      {answer ? (
        <div>
          <p style={{ margin: 0, fontWeight: 700 }}>{answer.indexable ? "Indexable" : "Not indexable"}</p>
          <ul style={{ margin: "6px 0 8px", paddingLeft: 20 }}>
            {answer.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <Link href={answer.href} className="adm-link">
            {answer.label}
          </Link>
        </div>
      ) : null}
    </section>
  );
}
