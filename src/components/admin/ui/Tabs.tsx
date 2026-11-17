"use client";

import { useEffect, useRef } from "react";
import "@/styles/admin-kit.css";

export type TabItem = { key: string; label: string; count?: number };

/**
 * Tabs with optional counts (UI-RULES section 1.7: inside the first card, above the filters).
 * Arrow keys, Home and End move between tabs. On a phone the strip scrolls and the active tab is kept in view.
 */
export function Tabs({
  items,
  active,
  onChange,
  label = "Sections",
  idPrefix = "tab",
  wrap = false,
}: {
  items: TabItem[];
  active: string;
  onChange: (key: string) => void;
  label?: string;
  /** Panels use `${idPrefix}-panel-${key}` and aria-labelledby `${idPrefix}-${key}`. */
  idPrefix?: string;
  /** Wrap onto a second row instead of scrolling sideways (a narrow drawer with many tabs). */
  wrap?: boolean;
}) {
  const strip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const current = strip.current?.querySelector<HTMLElement>("[aria-selected=true]");
    current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [active]);

  function onKey(event: React.KeyboardEvent, index: number) {
    const last = items.length - 1;
    const next = event.key === "ArrowRight" ? (index === last ? 0 : index + 1) : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1) : event.key === "Home" ? 0 : event.key === "End" ? last : -1;
    if (next < 0) return;
    event.preventDefault();
    onChange(items[next].key);
    strip.current?.querySelectorAll<HTMLElement>("[role=tab]")[next]?.focus();
  }

  return (
    <div className={`adm-k-tabs${wrap ? " is-wrap" : ""}`} role="tablist" aria-label={label} ref={strip}>
      {items.map((item, index) => {
        const selected = item.key === active;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            id={`${idPrefix}-${item.key}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${item.key}`}
            tabIndex={selected ? 0 : -1}
            className="adm-k-tab"
            onClick={() => onChange(item.key)}
            onKeyDown={(event) => onKey(event, index)}
          >
            {item.label}
            {typeof item.count === "number" ? <span className="adm-k-tab-count">{item.count.toLocaleString("en-IN")}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
