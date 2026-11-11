"use client";

import { useId } from "react";

/** Counter colour: grey, amber below `min`, green inside the range, red above `max`. */
export function counterTone(length: number, min?: number, max?: number): "" | "is-short" | "is-ok" | "is-long" {
  if (max !== undefined && length > max) return "is-long";
  if (min !== undefined && length < min) return length === 0 ? "" : "is-short";
  if (min !== undefined || max !== undefined) return length > 0 ? "is-ok" : "";
  return "";
}

export function TextField({
  label,
  value,
  onChange,
  help,
  error,
  min,
  max,
  multiline,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  help?: string;
  error?: string;
  min?: number;
  max?: number;
  multiline?: boolean;
  placeholder?: string;
  required?: boolean;
}) {
  const id = useId();
  const showCounter = min !== undefined || max !== undefined;
  const common = {
    id,
    className: `adm-input ${error ? "is-bad" : ""}`,
    value,
    placeholder,
    required,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": help || error ? `${id}-note` : undefined,
  };
  return (
    <div className="adm-field">
      <label className="adm-field-label" htmlFor={id}>
        {label}
        {required ? " *" : ""}
      </label>
      {multiline ? (
        <textarea {...common} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input type="text" {...common} onChange={(event) => onChange(event.target.value)} />
      )}
      {showCounter ? (
        <span className={`adm-counter ${counterTone(value.length, min, max)}`} aria-live="polite">
          {value.length}
          {max !== undefined ? ` / ${max}` : ""}
          {min !== undefined && value.length < min ? ` (min ${min})` : ""}
        </span>
      ) : null}
      {error ? (
        <p className="adm-field-error" id={`${id}-note`}>{error}</p>
      ) : help ? (
        <p className="adm-field-help" id={`${id}-note`}>{help}</p>
      ) : null}
    </div>
  );
}
