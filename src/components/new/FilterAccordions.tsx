"use client";

import { useId, useState } from "react";
import { ListFilter, SlidersHorizontal } from "lucide-react";
import type { ListingLabels, PanelRow } from "./listing-filters";

type PickRow = Exclude<PanelRow, { kind: "boolean" }>;

export function FilterAccordions({ rows, labels }: { rows: PickRow[]; labels: Pick<ListingLabels, "min" | "max"> }) {
  const base = useId();
  const [openKey, setOpenKey] = useState("");
  return (
    <div className="tkn-ls-acc" data-tk="filter-accordions">
      {rows.map((row) => {
        const open = openKey === row.key;
        const panelId = `${base}-${row.key}`;
        return (
          <div key={row.key} className="tkn-ls-row" data-open={open ? "true" : "false"}>
            <button type="button" className="tkn-ls-row-btn" aria-expanded={open} aria-controls={panelId} onClick={() => setOpenKey(open ? "" : row.key)}>
              {row.kind === "range" ? <SlidersHorizontal size={16} aria-hidden="true" /> : <ListFilter size={16} aria-hidden="true" />}
              <span className="tkn-ls-row-label">{row.picked > 0 ? `${row.label} \u00b7 ${row.picked}` : row.label}</span>
              <svg className="tkn-ls-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C2185B" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
            <div id={panelId} className={row.kind === "choice" ? "tkn-ls-panel tkn-ls-opts" : "tkn-ls-panel tkn-ls-range"} hidden={!open}>
              {row.kind === "choice" ? (
                row.options.map((option) => (
                  <label key={option.value} className="tkn-ls-opt">
                    <input type="checkbox" name={`f.${row.key}`} value={option.value} defaultChecked={option.picked} />
                    <span>{option.label}</span>
                  </label>
                ))
              ) : (
                <>
                  <input type="number" inputMode="numeric" min={0} name={`f.${row.key}_min`} defaultValue={row.min} placeholder={labels.min} aria-label={`${row.label} ${labels.min}`} />
                  <input type="number" inputMode="numeric" min={0} name={`f.${row.key}_max`} defaultValue={row.max} placeholder={labels.max} aria-label={`${row.label} ${labels.max}`} />
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
