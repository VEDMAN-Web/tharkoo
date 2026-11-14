"use client";

import { useMemo, useState, useTransition } from "react";
import { saveCategoryFieldsAction } from "@/app/admin/categories/field-actions";
import { addCategoryFieldAction, type ActionResult } from "@/app/admin/categories/option-actions";
import { Notice, TextField, Toggle } from "@/components/admin/ui";
import { FieldOptionsPanel } from "./FieldOptionsPanel";
import "./category-fields.css";

export interface EditorField {
  key: string;
  label: string;
  filterLabel: string;
  type: string;
  help: string;
  placeholder: string;
  required: boolean;
  enabled: boolean;
  filterable: boolean;
  maxPicks: number | null;
  optionCount: number;
}

/** The five kinds an admin can pick. Pick-many and pick-one can switch; the rest keep their type. */
const KIND_LABEL: Record<string, string> = {
  multiselect: "Pick many (chips)",
  select: "Pick one",
  range: "Number range",
  boolean: "Yes or no",
  text: "Short text",
};
const KIND_CHOICES = ["chips", "one", "range", "yesno", "text"] as const;
const KIND_TO_TYPE: Record<(typeof KIND_CHOICES)[number], string> = { chips: "multiselect", one: "select", range: "range", yesno: "boolean", text: "text" };
const SWITCHABLE = new Set(["select", "multiselect"]);

/** The fields as they are kept, with the option count left out (it changes when options are added on their own). */
function savedShape(rows: EditorField[]) {
  return rows.map((row) => ({ ...row, optionCount: 0 }));
}

/**
 * Fields and filters for one category. The field list holds the switches (post-ad, filter, required) and the order;
 * the panel on the right edits the selected field and its options. "Save changes" saves the field settings; options save as they are added.
 */
export function CategoryFieldsEditor({ slug, categoryName, initial }: { slug: string; categoryName: string; initial: EditorField[] }) {
  const [saved, setSaved] = useState(initial);
  const [fields, setFields] = useState(initial);
  const [selectedKey, setSelectedKey] = useState(initial[0]?.key ?? "");
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newKind, setNewKind] = useState<(typeof KIND_CHOICES)[number]>("chips");
  const [pending, startTransition] = useTransition();
  const dirty = useMemo(() => JSON.stringify(savedShape(fields)) !== JSON.stringify(savedShape(saved)), [fields, saved]);
  const current = fields.find((field) => field.key === selectedKey) ?? fields[0];

  function change(key: string, patch: Partial<EditorField>) {
    setFields((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function setCount(key: string, total: number) {
    setFields((rows) => rows.map((row) => (row.key === key ? { ...row, optionCount: total } : row)));
    setSaved((rows) => rows.map((row) => (row.key === key ? { ...row, optionCount: total } : row)));
  }

  function move(from: string, to: string) {
    if (from === to) return;
    setFields((rows) => {
      const fromIndex = rows.findIndex((row) => row.key === from);
      const toIndex = rows.findIndex((row) => row.key === to);
      if (fromIndex < 0 || toIndex < 0) return rows;
      const next = [...rows];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return next;
    });
  }

  function moveBy(key: string, step: number) {
    const index = fields.findIndex((row) => row.key === key);
    const target = fields[index + step];
    if (target) move(key, target.key);
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveCategoryFieldsAction(
        slug,
        fields.map((field) => ({
          key: field.key,
          label: field.label,
          help: field.help,
          placeholder: field.placeholder,
          required: field.required,
          enabled: field.enabled,
          filterable: field.filterable,
          filterLabel: field.filterLabel,
          maxPicks: field.maxPicks,
          ...(SWITCHABLE.has(field.type) ? { type: field.type as "select" | "multiselect" } : {}),
        })),
      );
      if (result.ok) {
        setSaved(fields);
        setMessage({ kind: "info", text: "Saved. The post-ad form and the filters now use these settings." });
      } else setMessage({ kind: "error", text: result.error });
    });
  }

  function addField() {
    setMessage(null);
    startTransition(async () => {
      const result: ActionResult<{ key: string; type: string }> = await addCategoryFieldAction(slug, newLabel, newKind);
      if (!result.ok) return setMessage({ kind: "error", text: result.error });
      const row: EditorField = {
        key: result.data.key,
        label: newLabel.trim(),
        filterLabel: "",
        type: result.data.type,
        help: "",
        placeholder: "",
        required: false,
        enabled: false,
        filterable: false,
        maxPicks: null,
        optionCount: 0,
      };
      setFields((rows) => [...rows, row]);
      setSaved((rows) => [...rows, row]);
      setSelectedKey(row.key);
      setNewLabel("");
      setMessage({ kind: "info", text: `Added ${row.label}. It is off on the post-ad form until you switch it on.` });
    });
  }

  if (!fields.length) {
    return <Notice kind="info" title="No fields yet">{categoryName} has no extra post-ad fields. Use Add field to start.</Notice>;
  }

  return (
    <div className="adm-stack" style={{ paddingBottom: 16 }}>
      <div className="adm-card" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h2 className="adm-field-label" style={{ fontSize: 18, margin: 0 }}>Fields and filters for {categoryName}</h2>
          <p className="adm-field-help">Each field shows in the post-ad form, and can also be a filter on the listing pages.</p>
        </div>
        <div className="adm-savebar-actions">
          <span className={`adm-savebar-status ${dirty ? "is-dirty" : ""}`} aria-live="polite">{dirty ? "Unsaved changes" : "All changes saved"}</span>
          <button type="button" className="adm-btn" disabled={!dirty || pending} onClick={save}>
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
      {message ? <Notice kind={message.kind}>{message.text}</Notice> : null}
      <div className="cf-layout">
        <section className="adm-card cf-table" aria-label="Fields">
          <div className="cf-head" role="row">
            <span />
            <span>Field</span>
            <span>Type</span>
            <span>Options</span>
            <span>Post-ad</span>
            <span>Filter</span>
            <span>Required</span>
          </div>
          {fields.map((field) => (
            <div
              key={field.key}
              className={`cf-row ${field.key === current?.key ? "is-selected" : ""} ${overKey === field.key ? "is-over" : ""}`}
              role="row"
              draggable
              onDragStart={() => setDragKey(field.key)}
              onDragOver={(event) => {
                event.preventDefault();
                setOverKey(field.key);
              }}
              onDragLeave={() => setOverKey(null)}
              onDrop={(event) => {
                event.preventDefault();
                if (dragKey) move(dragKey, field.key);
                setDragKey(null);
                setOverKey(null);
              }}
              onDragEnd={() => {
                setDragKey(null);
                setOverKey(null);
              }}
            >
              <span className="cf-handle" aria-hidden title="Drag to reorder">⋮⋮</span>
              <button type="button" className="cf-pick" onClick={() => setSelectedKey(field.key)} aria-current={field.key === current?.key ? "true" : undefined}>
                <span className="cf-name">{field.label || field.key}</span>
                <span className="cf-meta">Filter name: {field.filterLabel || field.label || field.key}</span>
              </button>
              <span className="cf-type cf-meta">{KIND_LABEL[field.type] ?? field.type}</span>
              <span className="cf-count cf-meta">{SWITCHABLE.has(field.type) ? `${field.optionCount} options` : "No list"}</span>
              <span className="cf-switch">
                <Toggle label="Post-ad" checked={field.enabled} onChange={(enabled) => change(field.key, { enabled })} />
              </span>
              <span className="cf-switch">
                <Toggle label="Filter" checked={field.filterable} onChange={(filterable) => change(field.key, { filterable })} />
              </span>
              <span className="cf-switch">
                <Toggle label="Required" checked={field.required} onChange={(required) => change(field.key, { required })} />
              </span>
            </div>
          ))}
        </section>
        {current ? (
          <aside className="adm-card cf-panel" aria-label={`Edit ${current.label}`} key={current.key}>
            <h3 className="adm-field-label" style={{ fontSize: 16, margin: 0 }}>Edit: {current.label || current.key}</h3>
            <div className="cf-two">
              <TextField label="Label on post-ad" value={current.label} onChange={(label) => change(current.key, { label })} min={1} max={80} required />
              <TextField label="Name in filters" value={current.filterLabel} onChange={(filterLabel) => change(current.key, { filterLabel })} max={40} />
            </div>
            <div className="cf-two">
              <div>
                <span className="adm-field-label">Type</span>
                {SWITCHABLE.has(current.type) ? (
                  <select
                    className="adm-input"
                    aria-label="Type"
                    value={current.type}
                    onChange={(event) => change(current.key, { type: event.target.value })}
                  >
                    <option value="multiselect">Pick many (chips)</option>
                    <option value="select">Pick one</option>
                  </select>
                ) : (
                  <p className="adm-field-help" style={{ margin: 0 }}>{KIND_LABEL[current.type] ?? current.type}</p>
                )}
              </div>
              {current.type === "multiselect" ? (
                <TextField
                  label="Most a user can pick"
                  value={current.maxPicks === null ? "" : String(current.maxPicks)}
                  onChange={(value) => change(current.key, { maxPicks: value.trim() === "" ? null : Math.max(1, Math.min(50, Math.floor(Number(value)) || 1)) })}
                  help="Leave empty for no limit."
                />
              ) : null}
            </div>
            <div className="cf-actions" role="group" aria-label={`Order of ${current.label}`}>
              <button type="button" className="adm-btn adm-btn-quiet" disabled={fields[0]?.key === current.key} onClick={() => moveBy(current.key, -1)}>
                Move up
              </button>
              <button type="button" className="adm-btn adm-btn-quiet" disabled={fields[fields.length - 1]?.key === current.key} onClick={() => moveBy(current.key, 1)}>
                Move down
              </button>
            </div>
            <FieldOptionsPanel slug={slug} field={{ key: current.key, label: current.label || current.key, type: current.type }} onCountChange={setCount} />
          </aside>
        ) : null}
      </div>
      <section className="adm-card" aria-label="Add a field" style={{ display: "grid", gap: 10 }}>
        <span className="adm-field-label">Add a field</span>
        <div className="cf-add">
          <TextField label="Field label" value={newLabel} onChange={setNewLabel} max={80} placeholder="For example, Looking for" />
          <div>
            <label className="adm-field-label" htmlFor="cf-new-kind" style={{ display: "block", marginBottom: 6 }}>Type</label>
            <select id="cf-new-kind" className="adm-input" value={newKind} onChange={(event) => setNewKind(event.target.value as (typeof KIND_CHOICES)[number])}>
              {KIND_CHOICES.map((kind) => (
                <option key={kind} value={kind}>{KIND_LABEL[KIND_TO_TYPE[kind]]}</option>
              ))}
            </select>
          </div>
          <button type="button" className="adm-btn adm-btn-ghost" disabled={pending || newLabel.trim() === ""} onClick={addField}>
            + Add field
          </button>
        </div>
      </section>
    </div>
  );
}
