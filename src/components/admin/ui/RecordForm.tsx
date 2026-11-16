"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ZodType } from "zod";
import "@/styles/admin-kit.css";
import { Button } from "./Button";
import { changedFields, fieldErrors } from "./kit-helpers";

export type RecordField = {
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "switch";
  help?: string;
  /** Shows a counter ("22 / 70") and stops typing at the limit. */
  max?: number;
  required?: boolean;
  options?: { value: string; label: string }[];
};

export type RecordValues = Record<string, unknown>;
export type SaveResult = { ok: boolean; message?: string } | void;

/**
 * A generic form driven by a zod schema (UI-RULES section 6): label above, help under, errors under the field in red and linked
 * with aria-describedby. Validates on blur and on Save. A save with errors shows a red summary box at the top with a link per field
 * and moves focus to it. The sticky bar shows a dot, "N unsaved changes" and which fields, then Discard (quiet) and Save (primary,
 * rightmost). Ctrl S saves, and leaving with unsaved changes asks first.
 */
export function RecordForm({
  schema,
  fields,
  initial,
  onSave,
  saveLabel = "Save changes",
}: {
  schema: ZodType;
  fields: RecordField[];
  initial: RecordValues;
  onSave: (values: RecordValues) => Promise<SaveResult> | SaveResult;
  saveLabel?: string;
}) {
  const uid = useId();
  const [saved, setSaved] = useState<RecordValues>(initial);
  const [values, setValues] = useState<RecordValues>(initial);
  const [touched, setTouched] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const summary = useRef<HTMLDivElement>(null);

  const parsed = useMemo(() => schema.safeParse(values), [schema, values]);
  const errors = useMemo(() => (parsed.success ? {} : fieldErrors(parsed.error.issues)), [parsed]);
  const changed = changedFields(saved, values);
  const dirty = changed.length > 0;
  const shown = (name: string) => (tried || touched.includes(name) ? errors[name] : undefined);
  const labelOf = (name: string) => fields.find((field) => field.name === name)?.label ?? name;

  const save = useCallback(async () => {
    setTried(true);
    if (!parsed.success) {
      window.setTimeout(() => summary.current?.focus(), 0);
      return;
    }
    setBusy(true);
    setNote("");
    const result = await onSave(values);
    setBusy(false);
    if (result && !result.ok) {
      setNote(result.message || "Could not save. Nothing you did was lost.");
      return;
    }
    setSaved(values);
    setTried(false);
    setTouched([]);
  }, [parsed, onSave, values]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (dirty && !busy) void save();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dirty, busy, save]);

  useEffect(() => {
    if (!dirty) return;
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  function set(name: string, value: unknown) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  const errorNames = tried ? Object.keys(errors) : [];
  return (
    <form className="adm-k-form" noValidate data-tk="record-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      {errorNames.length > 0 ? (
        <div className="adm-k-summary" role="alert" tabIndex={-1} ref={summary} data-tk="form-summary">
          <strong>Fix {errorNames.length === 1 ? "this field" : `these ${errorNames.length} fields`} before saving:</strong>
          <ul>
            {errorNames.map((name) => (
              <li key={name}>
                <a href={`#${uid}-${name}`} onClick={(event) => { event.preventDefault(); document.getElementById(`${uid}-${name}`)?.focus(); }}>
                  {labelOf(name)}: {errors[name]}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {note ? <p className="adm-k-err" role="alert">{note}</p> : null}
      {fields.map((field) => {
        const id = `${uid}-${field.name}`;
        const error = shown(field.name);
        const value = values[field.name];
        const describedBy = [field.help ? `${id}-h` : "", error ? `${id}-e` : ""].filter(Boolean).join(" ") || undefined;
        const common = { id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy, required: field.required, onBlur: () => setTouched((current) => (current.includes(field.name) ? current : [...current, field.name])) };
        const text = typeof value === "string" ? value : value === undefined || value === null ? "" : String(value);
        return (
          <div key={field.name} className="adm-k-field">
            {field.type === "switch" ? (
              <label className="adm-k-opt" htmlFor={id}>
                <input id={id} type="checkbox" checked={Boolean(value)} aria-describedby={describedBy} onChange={(event) => set(field.name, event.target.checked)} />
                <span>
                  <strong>{field.label}</strong>
                </span>
              </label>
            ) : (
              <label className="adm-k-label adm-k-lab" htmlFor={id}>
                <span>
                  {field.label}
                  {field.required ? <span className="adm-k-req" aria-hidden="true"> *</span> : null}
                </span>
                {field.max ? <span className="adm-k-count">{text.length} / {field.max}</span> : null}
              </label>
            )}
            {field.type === "text" ? <input {...common} className="adm-k-input" value={text} maxLength={field.max} onChange={(event) => set(field.name, event.target.value)} /> : null}
            {field.type === "textarea" ? <textarea {...common} className="adm-k-input" rows={4} value={text} maxLength={field.max} onChange={(event) => set(field.name, event.target.value)} /> : null}
            {field.type === "number" ? (
              <input
                {...common}
                className="adm-k-input"
                type="text"
                inputMode="numeric"
                value={text}
                onChange={(event) => {
                  const digits = event.target.value.replace(/[^\d]/g, "");
                  set(field.name, digits === "" ? "" : Number(digits));
                }}
              />
            ) : null}
            {field.type === "select" ? (
              <select {...common} className="adm-k-input" value={text} onChange={(event) => set(field.name, event.target.value)}>
                {(field.options ?? []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : null}
            {field.help ? <p className="adm-k-help" id={`${id}-h`}>{field.help}</p> : null}
            {error ? <p className="adm-k-err" id={`${id}-e`}>{error}</p> : null}
          </div>
        );
      })}
      <div className="adm-k-savebar" role="region" aria-label="Save changes" data-tk="save-bar" data-dirty={dirty ? "yes" : "no"}>
        <span className={`adm-k-savedot${dirty ? " is-dirty" : ""}`} aria-hidden="true" />
        <span className="adm-k-savetext" aria-live="polite">
          {dirty ? (
            <>
              <strong>{changed.length === 1 ? "1 unsaved change" : `${changed.length} unsaved changes`}</strong> <span>{changed.map(labelOf).join(", ")}</span>
            </>
          ) : (
            <span>All changes saved</span>
          )}
        </span>
        <span className="adm-k-sp" />
        <Button kind="quiet" disabled={!dirty || busy} onClick={() => { setValues(saved); setTried(false); setTouched([]); setNote(""); }}>
          Discard
        </Button>
        <Button kind="primary" busy={busy} disabled={!dirty} onClick={() => void save()}>
          {saveLabel}
        </Button>
      </div>
    </form>
  );
}
