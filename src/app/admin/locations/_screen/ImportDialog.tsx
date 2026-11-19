"use client";

import { useState } from "react";
import { Button } from "@/components/admin/ui";
import { FormDialog } from "@/app/admin/_catalog/FormDialog";
import { undoAction } from "@/app/admin/undo-actions";
import type { ImportKind, ImportPreview, ImportResult } from "@/server/locations/import";
import { previewImportAction, runImportAction } from "../import-actions";

const MAX_UPLOAD = 800_000;
type Source = "cities" | "areas" | "upload";

const CHOICES: { value: Source; label: string; help: string }[] = [
  { value: "cities", label: "Cities and towns of India", help: "The built-in list: places with about 1 lakh people or more, plus every district headquarters." },
  { value: "areas", label: "Areas of the largest cities", help: "The built-in list of well-known areas, added as districts of each city." },
  { value: "upload", label: "A CSV file of my own", help: "Cities: name, state, slug. Areas: city, name, slug. The first line names the columns." },
];

/**
 * H16.1: "Import cities and areas (CSV)". Choose the list, read the PREVIEW (new, already there, problems), then Import. An import only
 * adds missing places; it never renames or removes one. The result can be undone from here or from History.
 */
export function ImportDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (message: string) => void }) {
  const [source, setSource] = useState<Source>("cities");
  const [uploadKind, setUploadKind] = useState<ImportKind>("cities");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const kind: ImportKind = source === "upload" ? uploadKind : source;
  const input = { kind, from: source === "upload" ? ("upload" as const) : ("builtin" as const), text: source === "upload" ? text : undefined };

  function reset() {
    setPreview(null);
    setResult(null);
    setError("");
  }

  function close() {
    reset();
    setText("");
    setFileName("");
    onClose();
  }

  async function chooseFile(file: File | undefined) {
    reset();
    if (!file) return;
    if (file.size > MAX_UPLOAD) {
      setError("This file is too big. Keep it under 800 KB.");
      return;
    }
    setText(await file.text());
    setFileName(file.name);
  }

  async function read() {
    reset();
    setBusy(true);
    const answer = await previewImportAction(input);
    setBusy(false);
    if (!answer.ok) return setError(answer.message);
    setPreview(answer.preview);
  }

  async function add() {
    setBusy(true);
    const answer = await runImportAction(input);
    setBusy(false);
    if (!answer.ok) return setError(answer.message);
    setPreview(null);
    setResult(answer.result);
    onDone(`Added ${answer.result.added.toLocaleString("en-IN")} ${kind === "cities" ? "cities" : "areas"}.`);
  }

  async function undo() {
    if (!result?.eventId) return;
    setBusy(true);
    const outcome = await undoAction(result.eventId);
    setBusy(false);
    if (!outcome.ok) return setError(outcome.message);
    onDone("The import was undone.");
    close();
  }

  const noun = kind === "cities" ? "cities" : "areas";
  const canRead = source !== "upload" || text.trim().length > 0;
  return (
    <FormDialog
      open={open}
      title="Import cities and areas (CSV)"
      intro="Add many places at once. Only places that are missing are added. Nothing that is already there is renamed, moved or removed."
      onClose={close}
      footer={
        <>
          <Button onClick={close}>{result ? "Close" : "Cancel"}</Button>
          <span className="adm-k-sp" />
          {result ? (
            <Button busy={busy} onClick={() => void undo()}>Undo this import</Button>
          ) : preview && preview.fresh > 0 ? (
            <Button kind="primary" busy={busy} onClick={() => void add()}>{`Import ${preview.fresh.toLocaleString("en-IN")} new ${noun}`}</Button>
          ) : (
            <Button kind="primary" busy={busy} disabled={!canRead} onClick={() => void read()}>Preview</Button>
          )}
        </>
      }
    >
      <fieldset className="adm-cat-field" style={{ border: 0, padding: 0, margin: 0 }} disabled={busy || Boolean(result)}>
        <legend className="adm-k-label">What to import</legend>
        {CHOICES.map((item) => (
          <label key={item.value} style={{ display: "grid", gridTemplateColumns: "20px 1fr", gap: 8, padding: "6px 0", alignItems: "start" }}>
            <input
              type="radio"
              name="import-source"
              value={item.value}
              checked={source === item.value}
              onChange={() => {
                setSource(item.value);
                reset();
              }}
              data-tk={`import-source-${item.value}`}
            />
            <span>
              <strong>{item.label}</strong>
              <br />
              <span className="adm-k-help">{item.help}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {source === "upload" ? (
        <div className="adm-cat-field">
          <label className="adm-k-label" htmlFor="import-kind">What is in the file</label>
          <select
            id="import-kind"
            className="adm-k-input"
            value={uploadKind}
            onChange={(event) => {
              setUploadKind(event.target.value as ImportKind);
              reset();
            }}
          >
            <option value="cities">Cities (name, state, slug)</option>
            <option value="areas">Areas (city, name, slug)</option>
          </select>
          <label className="adm-k-label" htmlFor="import-file" style={{ marginTop: 8 }}>CSV file</label>
          <input id="import-file" className="adm-k-input" type="file" accept=".csv,text/csv" onChange={(event) => void chooseFile(event.target.files?.[0])} data-tk="import-file" />
          {fileName ? <span className="adm-k-help">{fileName}</span> : null}
        </div>
      ) : null}
      {preview ? (
        <div data-tk="import-preview" aria-live="polite">
          <p style={{ margin: "8px 0" }}>
            <strong data-tk="import-new">{`${preview.fresh.toLocaleString("en-IN")} new`}</strong>
            {", "}
            <span data-tk="import-existing">{`${preview.existing.toLocaleString("en-IN")} already there`}</span>
            {", "}
            <span data-tk="import-problems">{`${preview.problems.toLocaleString("en-IN")} ${preview.problems === 1 ? "problem" : "problems"}`}</span>
            {` (${preview.total.toLocaleString("en-IN")} rows in the file).`}
          </p>
          {preview.samples.length > 0 ? <p className="adm-k-help" data-tk="import-samples">{`For example: ${preview.samples.join("; ")}.`}</p> : null}
          {preview.problemRows.length > 0 ? (
            <ul data-tk="import-problem-list" style={{ margin: "8px 0", paddingLeft: 18 }}>
              {preview.problemRows.map((row) => (
                <li key={`${row.line}-${row.name}`}>{`Line ${row.line}, ${row.name}: ${row.message}`}</li>
              ))}
            </ul>
          ) : null}
          {preview.problems > 0 ? <p className="adm-k-help">Rows with a problem are skipped. Everything else can still be added.</p> : null}
          {preview.fresh === 0 ? <p className="adm-k-help">There is nothing new to add.</p> : null}
        </div>
      ) : null}
      {result ? (
        <p data-tk="import-done" role="status">{`Added ${result.added.toLocaleString("en-IN")} ${noun}. ${result.existing.toLocaleString("en-IN")} were already there and ${result.skipped.toLocaleString("en-IN")} were skipped.`}</p>
      ) : null}
      {error ? <p className="adm-k-err" role="alert" data-tk="import-error">{error}</p> : null}
    </FormDialog>
  );
}
