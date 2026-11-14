"use client";

import { useId, useState } from "react";
import { ImagePicker, type ImageRef } from "../ui/ImagePicker";
import { reorder } from "../ui/SortableList";
import { TextField } from "../ui/TextField";
import { Toggle } from "../ui/Toggle";
import type { Field, Props } from "./fields";
import { RichTextPreview } from "./RichTextPreview";
import { useDragRows } from "./useDragRows";

const asString = (value: unknown) => (typeof value === "string" ? value : "");
const asRecord = (value: unknown): Props => (typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Props) : {});
const asStrings = (value: unknown): string[] => (Array.isArray(value) ? value.map((entry) => String(entry)) : []);
const asRows = (value: unknown): Props[] => (Array.isArray(value) ? value.map(asRecord) : []);

/** All the inputs of one block (or of one repeated item), made from its field list. */
export function FieldsForm({ fields, value, onChange }: { fields: readonly Field[]; value: Props; onChange: (next: Props) => void }) {
  return (
    <div className="lay-fields">
      {fields.map((field) => (
        <FieldInput key={field.key} field={field} value={value[field.key]} props={value} onChange={(next) => onChange({ ...value, [field.key]: next })} />
      ))}
    </div>
  );
}

function FieldInput({ field, value, props, onChange }: { field: Field; value: unknown; props: Props; onChange: (next: unknown) => void }) {
  switch (field.kind) {
    case "text":
      return (
        <TextField label={field.label} value={asString(value)} onChange={onChange} max={field.max} multiline={field.multiline} required={field.required} help={field.help} />
      );
    case "richText":
      return (
        <div className="lay-rich">
          <TextField
            label={field.label}
            value={asString(value)}
            onChange={onChange}
            max={field.max}
            multiline
            required={field.required}
            help="Allowed: p, br, strong, em, ul, ol, li, h2, h3, a. Scripts and embeds are rejected."
          />
          <span className="adm-field-label">Preview</span>
          <RichTextPreview html={asString(value)} />
        </div>
      );
    case "image":
      return (
        <div className="lay-image">
          <ImagePicker label={field.label} value={(value as ImageRef | null | undefined) ?? null} onChange={onChange} />
          {field.help ? <p className="adm-field-help">{field.help}</p> : null}
        </div>
      );
    case "color":
      return <ColorField field={field} value={value} onChange={onChange} />;
    case "link":
      return <LinkField label={field.label} value={asRecord(value)} onChange={onChange} />;
    case "number":
      return <NumberField field={field} value={value} onChange={onChange} />;
    case "select":
      return <SelectField field={field} value={value} onChange={onChange} />;
    case "boolean":
      return <Toggle label={field.label} checked={typeof value === "boolean" ? value : typeof field.def === "function" ? field.def(props) : field.def} onChange={onChange} />;
    case "stringList":
      return <StringList field={field} value={Array.isArray(value) ? asStrings(value) : [...(field.def ?? [])]} onChange={onChange} />;
    case "multiSelect":
      return <MultiSelect field={field} value={Array.isArray(value) ? asStrings(value) : [...field.def]} onChange={onChange} />;
    case "items":
      return <ItemsField field={field} value={asRows(value)} onChange={onChange} />;
  }
}

const HEX6 = /^#[0-9a-fA-F]{6}$/;

function ColorField({ field, value, onChange }: { field: Extract<Field, { kind: "color" }>; value: unknown; onChange: (next: unknown) => void }) {
  const id = useId();
  return (
    <div className="adm-field">
      <label className="adm-field-label" htmlFor={id}>{field.label}</label>
      <input id={id} type="color" className="lay-color" value={typeof value === "string" && HEX6.test(value) ? value.toLowerCase() : field.def} onChange={(event) => onChange(event.target.value)} />
      {field.help ? <p className="adm-field-help">{field.help}</p> : null}
    </div>
  );
}

function LinkField({ label, value, onChange }: { label: string; value: Props; onChange: (next: unknown) => void }) {
  const set = (key: "label" | "href", next: string) => onChange({ ...value, [key]: next });
  return (
    <fieldset className="lay-group">
      <legend className="adm-field-label">{label}</legend>
      <TextField label="Link text" value={asString(value.label)} onChange={(next) => set("label", next)} max={60} />
      <TextField label="Address" value={asString(value.href)} onChange={(next) => set("href", next)} max={500} help="A full https link, or a path that starts with /" />
      {value.label || value.href ? (
        <button type="button" className="adm-btn adm-btn-quiet" onClick={() => onChange(null)}>
          Remove {label.toLowerCase()}
        </button>
      ) : null}
    </fieldset>
  );
}

function NumberField({ field, value, onChange }: { field: Extract<Field, { kind: "number" }>; value: unknown; onChange: (next: unknown) => void }) {
  const id = useId();
  return (
    <div className="adm-field">
      <label className="adm-field-label" htmlFor={id}>{field.label}</label>
      <input
        id={id}
        type="number"
        className="adm-input"
        min={field.min}
        max={field.max}
        value={typeof value === "number" ? value : ""}
        placeholder={field.def !== undefined ? `${field.def} (default)` : ""}
        onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))}
      />
      <p className="adm-field-help">From {field.min} to {field.max}</p>
    </div>
  );
}

function SelectField({ field, value, onChange }: { field: Extract<Field, { kind: "select" }>; value: unknown; onChange: (next: unknown) => void }) {
  const id = useId();
  return (
    <div className="adm-field">
      <label className="adm-field-label" htmlFor={id}>{field.label}</label>
      <select id={id} className="adm-input" value={typeof value === "string" ? value : field.def} onChange={(event) => onChange(event.target.value)}>
        {field.options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </div>
  );
}

function StringList({ field, value, onChange }: { field: Extract<Field, { kind: "stringList" }>; value: string[]; onChange: (next: unknown) => void }) {
  const drag = useDragRows((from, to) => onChange(reorder(value, from, to)));
  const setAt = (index: number, next: string) => onChange(value.map((entry, i) => (i === index ? next : entry)));
  return (
    <fieldset className="lay-group">
      <legend className="adm-field-label">{field.label}</legend>
      {value.length === 0 ? <p className="adm-field-help">None yet.</p> : null}
      {value.map((entry, index) => (
        <div key={index} className={`lay-row ${drag.over === index ? "is-over" : ""}`} data-drag-row {...drag.rowProps(index)}>
          <span className="adm-sort-handle" aria-hidden {...drag.handleProps(index)}>⠿</span>
          <input
            className="adm-input"
            aria-label={`${field.itemLabel} ${index + 1}`}
            value={entry}
            maxLength={field.itemMax}
            onChange={(event) => setAt(index, event.target.value)}
          />
          <RowButtons index={index} count={value.length} name={`${field.itemLabel} ${index + 1}`} onMove={(to) => onChange(reorder(value, index, to))} onRemove={() => onChange(value.filter((_, i) => i !== index))} />
        </div>
      ))}
      <button type="button" className="adm-btn adm-btn-quiet" disabled={value.length >= field.max} onClick={() => onChange([...value, ""])}>
        Add {field.itemLabel.toLowerCase()}
      </button>
      <span className="adm-field-help">{value.length} of {field.max}</span>
    </fieldset>
  );
}

function MultiSelect({ field, value, onChange }: { field: Extract<Field, { kind: "multiSelect" }>; value: string[]; onChange: (next: unknown) => void }) {
  return (
    <fieldset className="lay-group">
      <legend className="adm-field-label">{field.label}</legend>
      <div className="lay-checks">
        {field.options.map((option) => (
          <label key={option} className="lay-check">
            <input
              type="checkbox"
              checked={value.includes(option)}
              onChange={(event) => onChange(event.target.checked ? [...value, option] : value.filter((entry) => entry !== option))}
            />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function RowButtons({ index, count, name, onMove, onRemove }: { index: number; count: number; name: string; onMove: (to: number) => void; onRemove: () => void }) {
  return (
    <span className="lay-row-buttons">
      <button type="button" className="adm-sort-move" aria-label={`Move ${name} up`} disabled={index === 0} onClick={() => onMove(index - 1)}>↑</button>
      <button type="button" className="adm-sort-move" aria-label={`Move ${name} down`} disabled={index === count - 1} onClick={() => onMove(index + 1)}>↓</button>
      <button type="button" className="adm-sort-move lay-remove" aria-label={`Remove ${name}`} onClick={onRemove}>✕</button>
    </span>
  );
}

function ItemsField({ field, value, onChange }: { field: Extract<Field, { kind: "items" }>; value: Props[]; onChange: (next: unknown) => void }) {
  const [open, setOpen] = useState<number | null>(null);
  const move = (from: number, to: number) => {
    onChange(reorder(value, from, to));
    setOpen((current) => (current === from ? to : current));
  };
  const drag = useDragRows(move);
  const nameOf = (item: Props, index: number) => asString(item[field.titleKey]).trim() || `${field.itemName[0].toUpperCase()}${field.itemName.slice(1)} ${index + 1}`;
  return (
    <fieldset className="lay-group">
      <legend className="adm-field-label">{field.label}</legend>
      {value.length === 0 ? <p className="adm-field-help">No {field.itemName}s yet.</p> : null}
      {value.map((item, index) => (
        <div key={index} className={`lay-item ${drag.over === index ? "is-over" : ""}`} data-drag-row {...drag.rowProps(index)}>
          <div className="lay-row">
            <span className="adm-sort-handle" aria-hidden {...drag.handleProps(index)}>⠿</span>
            <button type="button" className="lay-item-title" aria-expanded={open === index} onClick={() => setOpen(open === index ? null : index)}>
              {nameOf(item, index)}
            </button>
            <RowButtons
              index={index}
              count={value.length}
              name={nameOf(item, index)}
              onMove={(to) => move(index, to)}
              onRemove={() => {
                onChange(value.filter((_, i) => i !== index));
                setOpen(null);
              }}
            />
          </div>
          {open === index ? (
            <FieldsForm fields={field.fields} value={item} onChange={(next) => onChange(value.map((entry, i) => (i === index ? next : entry)))} />
          ) : null}
        </div>
      ))}
      <button
        type="button"
        className="adm-btn adm-btn-quiet"
        disabled={value.length >= field.max}
        onClick={() => {
          onChange([...value, {}]);
          setOpen(value.length);
        }}
      >
        Add {field.itemName}
      </button>
      <span className="adm-field-help">{value.length} of {field.max}</span>
    </fieldset>
  );
}
