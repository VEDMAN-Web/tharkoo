"use client";

import { SEARCH_FROM, SearchSelect, type SearchOption } from "@/components/ui/SearchSelect";

const ADMIN_LOOK = {
  "--ss-bg": "var(--adm-card)",
  "--ss-text": "var(--adm-text)",
  "--ss-line": "var(--adm-border)",
  "--ss-muted": "var(--adm-muted)",
  "--ss-active": "var(--adm-bg)",
} as React.CSSProperties;

/** H16.1c: a long list in an admin form (about 900 cities) is a type-ahead box with the admin look; a short one stays a plain select. */
export function AdminSearchSelect({
  value,
  options,
  firstLabel,
  disabled,
  onChange,
}: {
  value: string;
  options: readonly SearchOption[];
  /** The choice for "none", for example "All cities". It is the first row of a short list and the placeholder of a long one. */
  firstLabel?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  if (options.length > SEARCH_FROM) {
    return <SearchSelect inputClassName="adm-input" style={ADMIN_LOOK} value={value} options={options} placeholder={`${firstLabel ?? "Choose"} (type to search)`} emptyText="No match. Keep typing." disabled={disabled} onChange={onChange} />;
  }
  return (
    <select className="adm-input" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      {firstLabel ? <option value="">{firstLabel}</option> : null}
      {options.map((item) => (
        <option key={item.value} value={item.value}>{item.label}</option>
      ))}
    </select>
  );
}
