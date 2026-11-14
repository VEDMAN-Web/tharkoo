"use client";

import type { ReactNode } from "react";

export interface RailItem {
  label: string;
}

/** The step rail: five steps, the current one marked, the finished ones ticked. */
export function PostRail({ items, step }: { items: RailItem[]; step: number }) {
  return (
    <ol className="tk-post-rail" data-tk="progress" aria-label="Steps to post your ad">
      {items.map((item, index) => {
        const number = index + 1;
        const state = number < step ? "done" : number === step ? "current" : "todo";
        return (
          <li key={`${number}-${item.label}`} data-state={state} aria-current={state === "current" ? "step" : undefined}>
            <span className="tk-post-rail-dot" aria-hidden>{state === "done" ? "✓" : number}</span>
            <span className="tk-post-rail-label">{item.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Category tiles: one button per category, pressed when chosen. */
export function CategoryTiles({ categories, value, error, onChange }: { categories: { _id: string; name: string }[]; value: string; error?: string; onChange: (id: string) => void }) {
  return (
    <div className="tk-cat-tiles" role="group" aria-label="Category">
      {categories.map((cat) => (
        <button key={cat._id} type="button" className={`tk-cat-tile ${value === cat._id ? "on" : ""}`} aria-pressed={value === cat._id} data-tk="category-tile" onClick={() => onChange(cat._id)}>
          {cat.name}
        </button>
      ))}
      {error ? <span className="tk-error" data-tk="field-error">{error}</span> : null}
    </div>
  );
}

export function Group({ title, help, children }: { title: string; help?: string; children: ReactNode }) {
  return (
    <section className="tk-post-group">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h2 className="tk-group-h">{title}</h2>
        <span className="t-caption tk-required-note">* Required fields</span>
      </div>
      <div className="tk-form-panel">
        {help ? <p className="t-small">{help}</p> : null}
        {children}
      </div>
    </section>
  );
}

export function SelectField({
  id,
  label,
  required,
  value,
  error,
  disabled,
  help,
  onChange,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  value: string;
  error?: string;
  disabled?: boolean;
  help?: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className={`tk-field ${error ? "is-bad" : ""}`} htmlFor={id}>
      <span>{required ? "* " : ""}{label}</span>
      <select id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{children}</select>
      {help ? <span className="t-caption" style={{ color: "var(--muted)" }}>{help}</span> : null}
      {error ? <span className="tk-error" data-tk="field-error">{error}</span> : null}
    </label>
  );
}

export function TextField({
  id,
  label,
  required,
  value,
  error,
  note,
  placeholder,
  area,
  rows,
  onChange,
}: {
  id: string;
  label: string;
  required?: boolean;
  value: string;
  error?: string;
  note?: string;
  placeholder?: string;
  area?: boolean;
  rows?: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className={`tk-field ${error ? "is-bad" : ""}`} htmlFor={id}>
      <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span>{required ? "* " : ""}{label}</span>
        {note ? <span style={{ fontWeight: 500, color: "var(--muted)" }}>{note}</span> : null}
      </span>
      {area ? (
        <textarea id={id} rows={rows || 2} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input id={id} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      )}
      {error ? <span className="tk-error" data-tk="field-error">{error}</span> : null}
    </label>
  );
}

export function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`tk-switch ${on ? "on" : ""}`} onClick={onClick}>
      <i />
    </button>
  );
}
