"use client";

import { useState, useTransition } from "react";
import { DataTable, Notice, TextField, type Column } from "@/components/admin/ui";
import type { DryRunReport, ImportReport, ImportRowReport } from "@/server/listings/import";
import { importAction } from "./actions";

const COLUMNS: Column<ImportRowReport>[] = [
  { key: "line", label: "Line", sortable: true },
  { key: "title", label: "Title", sortable: true },
  { key: "ok", label: "Result", sortable: true, value: (row) => (row.ok ? "OK" : "Error") },
  { key: "errors", label: "Problems", value: (row) => row.errors.join("; ") },
];

const HEADER_HELP =
  "Columns: category, city, district, title, description, photos (our own upload URLs, separated by |), then one column per category field key, for example price. Category, city and district are slugs. At most 200 rows.";

export function ImportForm({ canPublish }: { canPublish: boolean }) {
  const [partner, setPartner] = useState("");
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [publishNow, setPublishNow] = useState(false);
  const [dry, setDry] = useState<DryRunReport | null>(null);
  const [done, setDone] = useState<ImportReport | null>(null);
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();

  function reset(keepFile = false) {
    setDry(null);
    setDone(null);
    setError("");
    if (!keepFile) {
      setCsv("");
      setFileName("");
    }
  }

  async function pick(file: File | undefined) {
    reset();
    if (!file) return;
    setFileName(file.name);
    setCsv(await file.text());
  }

  function run(step: "dry" | "import") {
    setError("");
    startTransition(async () => {
      const result = await importAction({ step, partnerEmail: partner, csv, status: publishNow ? "active" : "pending" });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.kind === "dry") {
        setDone(null);
        setDry(result.report);
      } else {
        setDry(null);
        setDone(result.report);
      }
    });
  }

  const shown = done ?? dry;
  const ready = Boolean(partner.trim() && csv);

  return (
    <div className="adm-stack">
      <section className="adm-card">
        <div style={{ display: "grid", gap: 16, maxWidth: 640 }}>
          <TextField label="Partner account email" value={partner} onChange={(value) => { setPartner(value); setDry(null); }} required help="The account must be ID-verified." />
          <div className="adm-field">
            <label className="adm-field-label" htmlFor="import-file">CSV file *</label>
            <input id="import-file" className="adm-input" type="file" accept=".csv,text/csv" onChange={(event) => void pick(event.target.files?.[0])} />
            <p className="adm-field-help">{fileName ? `Chosen: ${fileName}` : HEADER_HELP}</p>
          </div>
          {canPublish ? (
            <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}>
              <input type="checkbox" checked={publishNow} onChange={(event) => setPublishNow(event.target.checked)} />
              <span>Publish at once (skip the moderation queue)</span>
            </label>
          ) : null}
          <div>
            <button type="button" className="adm-btn" disabled={!ready || busy} onClick={() => run("dry")}>
              {busy && !shown ? "Checking..." : "Step 1: check the file (dry run)"}
            </button>
          </div>
        </div>
      </section>

      {error ? <Notice kind="error" title="Could not continue">{error}</Notice> : null}

      {done ? (
        <Notice kind={done.failed ? "warn" : "info"} title="Import finished">
          {done.imported} of {done.total} listings were imported as {done.status === "active" ? "active" : "pending moderation"} for {done.partner.email}.
          {done.failed ? ` ${done.failed} failed while saving; see the table.` : ""}
        </Notice>
      ) : null}

      {dry ? (
        <Notice kind={dry.okCount === dry.total ? "info" : "warn"} title="Dry run, nothing has been saved">
          {dry.okCount} of {dry.total} rows are OK for {dry.partner.displayName} ({dry.partner.email}). Only OK rows will be imported.
        </Notice>
      ) : null}

      {shown ? (
        <section>
          <DataTable columns={COLUMNS} rows={shown.rows} rowKey={(row) => String(row.line)} csvName="import-report" />
        </section>
      ) : null}

      {dry && dry.okCount > 0 ? (
        <div>
          <button type="button" className="adm-btn" disabled={busy} onClick={() => run("import")}>
            {busy ? "Importing..." : `Step 2: import ${dry.okCount} listing${dry.okCount === 1 ? "" : "s"} as ${publishNow ? "active" : "pending"}`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
