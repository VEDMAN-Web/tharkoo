"use client";

import type { AdFormField } from "@/server/listings/admin-form";

export type AttributeValues = Record<string, unknown>;

const stack = { display: "grid", gap: 4, minWidth: 0 } as const;

function label(field: AdFormField) {
  return `${field.label}${field.unit ? ` (${field.unit})` : ""}${field.required ? " *" : ""}`;
}

function Help({ text }: { text: string }) {
  return text ? <span className="adm-field-help">{text}</span> : null;
}

function Multi({ field, value, onChange }: { field: AdFormField; value: unknown; onChange: (next: unknown) => void }) {
  const picked = Array.isArray(value) ? (value as string[]) : [];
  return (
    <fieldset style={{ ...stack, border: 0, padding: 0, margin: 0 }}>
      <legend className="adm-field-label">{label(field)}</legend>
      {field.options.map((option) => (
        <label key={option} style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={picked.includes(option)}
            onChange={(event) => onChange(event.target.checked ? [...picked, option] : picked.filter((item) => item !== option))}
          />
          <span>{option}</span>
        </label>
      ))}
      <Help text={field.help} />
    </fieldset>
  );
}

function Range({ field, value, onChange }: { field: AdFormField; value: unknown; onChange: (next: unknown) => void }) {
  const range = (value && typeof value === "object" ? value : {}) as { min?: number | string; max?: number | string };
  const set = (part: "min" | "max", raw: string) => onChange({ ...range, [part]: raw });
  return (
    <div style={stack}>
      <span className="adm-field-label">{label(field)}</span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input className="adm-input" type="number" aria-label={`${field.label}: from`} placeholder="From" value={range.min ?? ""} onChange={(event) => set("min", event.target.value)} style={{ flex: "1 1 120px", minWidth: 0 }} />
        <input className="adm-input" type="number" aria-label={`${field.label}: to`} placeholder="To" value={range.max ?? ""} onChange={(event) => set("max", event.target.value)} style={{ flex: "1 1 120px", minWidth: 0 }} />
      </div>
      <Help text={field.help} />
    </div>
  );
}

function Control({ field, value, onChange }: { field: AdFormField; value: unknown; onChange: (next: unknown) => void }) {
  if (field.type === "multiselect") return <Multi field={field} value={value} onChange={onChange} />;
  if (field.type === "range") return <Range field={field} value={value} onChange={onChange} />;
  if (field.type === "boolean" || field.type === "bool") {
    return (
      <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} />
        <span>
          {label(field)}
          <Help text={field.help} />
        </span>
      </label>
    );
  }
  const text = typeof value === "string" || typeof value === "number" ? String(value) : "";
  const common = { className: "adm-input", "aria-label": field.label, value: text, placeholder: field.placeholder || undefined, style: { maxWidth: "100%" } } as const;
  return (
    <label style={stack}>
      <span className="adm-field-label">{label(field)}</span>
      {field.type === "select" ? (
        <select {...common} onChange={(event) => onChange(event.target.value)}>
          <option value="">Choose</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : field.type === "textarea" ? (
        <textarea {...common} rows={4} maxLength={2000} onChange={(event) => onChange(event.target.value)} />
      ) : field.type === "number" ? (
        <input {...common} type="number" min={field.min ?? undefined} max={field.max ?? undefined} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input {...common} type={field.type === "date" ? "date" : "text"} maxLength={500} onChange={(event) => onChange(event.target.value)} />
      )}
      <Help text={field.help} />
    </label>
  );
}

/** One input per enabled field of the category, in the category's order. */
export function AdAttributeFields({ fields, values, onChange }: { fields: AdFormField[]; values: AttributeValues; onChange: (key: string, value: unknown) => void }) {
  if (fields.length === 0) return <p className="adm-field-help">This category has no extra fields.</p>;
  return (
    <div className="adm-stack" style={{ minWidth: 0 }}>
      {fields.map((field) => (
        <Control key={field.key} field={field} value={values[field.key]} onChange={(next) => onChange(field.key, next)} />
      ))}
    </div>
  );
}

function clean(field: AdFormField, value: unknown): unknown {
  if (value === undefined || value === null) return undefined;
  if (field.type === "number") return typeof value === "string" && value.trim() !== "" ? Number(value) : undefined;
  if (field.type === "boolean" || field.type === "bool") return typeof value === "boolean" ? value : undefined;
  if (field.type === "multiselect") return Array.isArray(value) && value.length > 0 ? value : undefined;
  if (field.type === "range") {
    const range = value as { min?: string | number; max?: string | number };
    const min = range.min === undefined || range.min === "" ? undefined : Number(range.min);
    const max = range.max === undefined || range.max === "" ? undefined : Number(range.max);
    return min === undefined && max === undefined ? undefined : { ...(min === undefined ? {} : { min }), ...(max === undefined ? {} : { max }) };
  }
  const text = String(value).trim();
  return text === "" ? undefined : text;
}

/** The values the server expects: blanks are left out, numbers become numbers. */
export function attributePayload(fields: AdFormField[], values: AttributeValues): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    const next = clean(field, values[field.key]);
    if (next !== undefined) out[field.key] = next;
  }
  return out;
}
