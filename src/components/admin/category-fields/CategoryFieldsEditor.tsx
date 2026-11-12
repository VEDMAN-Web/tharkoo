"use client";

import { useState, useTransition } from "react";
import { saveCategoryFieldsAction } from "@/app/admin/categories/field-actions";
import { Notice, SortableList, TextField, Toggle } from "@/components/admin/ui";

export interface EditorField {
  key: string;
  label: string;
  type: string;
  help: string;
  placeholder: string;
  required: boolean;
  options: string[];
}

const CHOICE_TYPES = ["select", "multiselect"];

/** The options box keeps the raw text, so Enter works while typing; it is split into options on save. */
type Row = Omit<EditorField, "options"> & { optionsText: string };

const toRow = ({ options, ...field }: EditorField): Row => ({ ...field, optionsText: options.join("\n") });
const parseOptions = (text: string) => text.split("\n").map((line) => line.trim()).filter(Boolean);

/** Edits the labels, help, placeholders, required flags, order and options of one category's post-ad fields. */
export function CategoryFieldsEditor({ slug, categoryName, initial }: { slug: string; categoryName: string; initial: EditorField[] }) {
  const [saved, setSaved] = useState(() => initial.map(toRow));
  const [fields, setFields] = useState(saved);
  const [message, setMessage] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(fields) !== JSON.stringify(saved);

  function change(key: string, patch: Partial<Row>) {
    setFields((current) => current.map((field) => (field.key === key ? { ...field, ...patch } : field)));
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveCategoryFieldsAction(
        slug,
        fields.map(({ key, label, help, placeholder, required, optionsText }) => ({ key, label, help, placeholder, required, options: parseOptions(optionsText) })),
      );
      if (result.ok) {
        setSaved(fields);
        setMessage({ kind: "info", text: "Saved. The post-ad form now shows these fields." });
      } else setMessage({ kind: "error", text: result.error });
    });
  }

  if (!fields.length) {
    return <Notice kind="info" title="No fields yet">{categoryName} has no extra post-ad fields. Fields are added when the category is set up.</Notice>;
  }

  return (
    <div className="adm-stack" style={{ display: "grid", gap: 16, paddingBottom: 88 }}>
      <section className="adm-card">
        <h2 className="adm-field-label" style={{ fontSize: 16 }}>Order of fields</h2>
        <p className="adm-field-help">Drag a row, or use the arrows. This is the order in the post-ad form.</p>
        <SortableList
          label={`Fields of ${categoryName}`}
          items={fields.map((field) => ({ id: field.key, label: field.label || field.key }))}
          onChange={(items) => setFields((current) => items.map((item) => current.find((field) => field.key === item.id) as Row))}
        />
      </section>
      {fields.map((field) => (
        <section key={field.key} className="adm-card" aria-label={`Field ${field.label || field.key}`}>
          <h3 className="adm-field-label" style={{ fontSize: 15 }}>
            {field.label || field.key} <span className="adm-field-help">({field.type}, key {field.key})</span>
          </h3>
          <TextField label="Label" value={field.label} onChange={(label) => change(field.key, { label })} min={1} max={80} required />
          <TextField label="Help text" value={field.help} onChange={(help) => change(field.key, { help })} max={200} help="Shown under the field in the post-ad form." />
          <TextField label="Placeholder" value={field.placeholder} onChange={(placeholder) => change(field.key, { placeholder })} max={120} />
          <Toggle label="Required" checked={field.required} onChange={(required) => change(field.key, { required })} />
          {CHOICE_TYPES.includes(field.type) ? (
            <TextField
              label="Options (one per line)"
              multiline
              value={field.optionsText}
              onChange={(optionsText) => change(field.key, { optionsText })}
              help="Visitors see the options in this order. More than eight options show as a drop-down."
            />
          ) : null}
        </section>
      ))}
      {message ? <Notice kind={message.kind}>{message.text}</Notice> : null}
      <div className="adm-savebar" role="region" aria-label="Save changes">
        <span className={`adm-savebar-status ${dirty ? "is-dirty" : ""}`} aria-live="polite">{dirty ? "Unsaved changes" : "All changes saved"}</span>
        <div className="adm-savebar-actions">
          <button type="button" className="adm-btn" disabled={!dirty || pending} onClick={save}>
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
