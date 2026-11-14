"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { addFieldOptionsAction, listFieldOptionsAction, removeFieldOptionAction } from "@/app/admin/categories/option-actions";
import { Notice, TextField } from "@/components/admin/ui";

const PAGE = 200;
const MAX_CSV_BYTES = 1024 * 1024;

export interface PanelField {
  key: string;
  label: string;
  type: string;
}

interface Summary {
  added: number;
  skipped: number;
  duplicates: number;
  rejected: Array<{ line: number; reason: string }>;
}

/** Summary of an add, in plain words. Lines that were not added name their line number, never their text. */
function describe(summary: Summary): string {
  const parts = [`Added ${summary.added}.`];
  if (summary.skipped) parts.push(`${summary.skipped} already in the list.`);
  if (summary.duplicates) parts.push(`${summary.duplicates} repeated in the paste.`);
  if (summary.rejected.length) {
    const lines = summary.rejected.slice(0, 5).map((item) => (item.line ? `line ${item.line}: ${item.reason}` : item.reason));
    parts.push(`Not added: ${lines.join("; ")}.`);
  }
  return parts.join(" ");
}

/** The option list of one pick-one or pick-many field: search, chips to remove, paste one per line, or import a CSV. */
export function FieldOptionsPanel({
  slug,
  field,
  onCountChange,
}: {
  slug: string;
  field: PanelField;
  onCountChange: (key: string, total: number) => void;
}) {
  const isChoice = field.type === "select" || field.type === "multiselect";
  const [items, setItems] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(PAGE);
  const [query, setQuery] = useState("");
  const [version, setVersion] = useState(0);
  const [paste, setPaste] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // The count goes up to the parent through a ref, so a new callback identity never restarts the load.
  const countRef = useRef(onCountChange);

  useEffect(() => {
    countRef.current = onCountChange;
  });

  useEffect(() => {
    if (!isChoice) return;
    let cancelled = false;
    listFieldOptionsAction(slug, field.key, { q: query, limit }).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setItems(result.data.items.map((item) => item.value));
        setTotal(result.data.total);
        countRef.current(field.key, result.data.total);
      } else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [slug, field.key, query, limit, version, isChoice]);

  function refreshCount(next: number) {
    setTotal(next);
    countRef.current(field.key, next);
    setVersion((current) => current + 1);
  }

  function addText(text: string, source: "paste" | "csv") {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await addFieldOptionsAction(slug, field.key, text, source);
      if (!result.ok) return setError(result.error);
      setNotice(describe(result.data));
      if (source === "paste") setPaste("");
      setQuery("");
      refreshCount(result.data.total);
    });
  }

  function remove(value: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeFieldOptionAction(slug, field.key, value);
      if (!result.ok) return setError(result.error);
      setItems((current) => current.filter((item) => item !== value));
      refreshCount(result.data.total);
    });
  }

  async function importCsv(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_CSV_BYTES) return setError("That file is larger than 1 MB. Split it into smaller files.");
    addText(await file.text(), "csv");
  }

  if (!isChoice) {
    return <p className="adm-field-help">{field.label} takes a short answer, so it has no option list.</p>;
  }

  return (
    <div className="cf-panel">
      <div>
        <span className="adm-field-label">Options</span>
        <p className="adm-field-help">Each option is saved as soon as you add or remove it. {total} in total.</p>
      </div>
      <TextField label="Search options" value={query} onChange={setQuery} placeholder={`Search ${total}`} />
      {items.length === 0 && !pending ? <p className="adm-field-help">{query ? "No option matches that search." : "No options yet. Add some below."}</p> : null}
      <ul className="cf-chips" aria-label={`Options of ${field.label}`}>
        {items.map((item) => (
          <li key={item} className="cf-chip">
            <span>{item}</span>
            <button type="button" aria-label={`Remove ${item}`} disabled={pending} onClick={() => remove(item)}>
              ×
            </button>
          </li>
        ))}
      </ul>
      {items.length < total ? (
        <button type="button" className="adm-btn adm-btn-quiet" onClick={() => setLimit((current) => current + PAGE)}>
          Show more ({total - items.length} more)
        </button>
      ) : null}
      <TextField
        label="Add options, one per line"
        value={paste}
        onChange={setPaste}
        multiline
        max={20000}
        help={`Up to 1,000 lines at a time. Repeats and blank lines are skipped.`}
      />
      <div className="cf-actions">
        <button type="button" className="adm-btn" disabled={pending || paste.trim() === ""} onClick={() => addText(paste, "paste")}>
          Add to list
        </button>
        <label className="adm-btn adm-btn-quiet" style={{ cursor: "pointer" }}>
          Import from CSV
          <input
            type="file"
            accept=".csv,text/csv"
            style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}
            disabled={pending}
            onChange={(event) => {
              void importCsv(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      <p className="adm-field-help">A CSV file uses the first column, one option per row. A header row is skipped.</p>
      {notice ? <Notice kind="info">{notice}</Notice> : null}
      {error ? <Notice kind="error">{error}</Notice> : null}
    </div>
  );
}
