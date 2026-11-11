"use client";

import { useState } from "react";

export interface SortableItem {
  id: string;
  label: string;
}

/** Returns a new array with the item at `from` moved to `to` (the input is not changed). */
export function reorder<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return [...items];
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Drag rows with the mouse, or use the up and down buttons (keyboard and phone friendly). */
export function SortableList({ items, onChange, label }: { items: SortableItem[]; onChange: (next: SortableItem[]) => void; label: string }) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  return (
    <ul className="adm-sort" aria-label={label}>
      {items.map((item, index) => (
        <li
          key={item.id}
          className={`adm-sort-row ${over === index ? "is-over" : ""}`}
          draggable
          onDragStart={() => setDragFrom(index)}
          onDragOver={(event) => {
            event.preventDefault();
            setOver(index);
          }}
          onDragLeave={() => setOver((current) => (current === index ? null : current))}
          onDrop={(event) => {
            event.preventDefault();
            if (dragFrom !== null) onChange(reorder(items, dragFrom, index));
            setDragFrom(null);
            setOver(null);
          }}
          onDragEnd={() => {
            setDragFrom(null);
            setOver(null);
          }}
        >
          <span className="adm-sort-handle" aria-hidden>⠿</span>
          <span className="adm-sort-label">{item.label}</span>
          <button type="button" className="adm-sort-move" aria-label={`Move ${item.label} up`} disabled={index === 0} onClick={() => onChange(reorder(items, index, index - 1))}>
            ↑
          </button>
          <button type="button" className="adm-sort-move" aria-label={`Move ${item.label} down`} disabled={index === items.length - 1} onClick={() => onChange(reorder(items, index, index + 1))}>
            ↓
          </button>
        </li>
      ))}
    </ul>
  );
}
