"use client";

import Link from "next/link";
import { GripVertical } from "lucide-react";
import { MoveButtons } from "@/components/admin/ui";
import { useDragRows } from "@/components/admin/layout-editor/useDragRows";
import type { CategoryRowView } from "@/server/categories/screen";
import { adsText } from "./model";

/**
 * The one list of categories: drag handle, the Home tile picture (a dashed box when there is none), the name,
 * "hidden" in muted text, and the arrows for the keyboard. The row opens the category on the right.
 */
export function CategoryList({
  rows,
  selectedId,
  hrefFor,
  onMove,
  onOpen,
  canEdit,
}: {
  rows: CategoryRowView[];
  selectedId: string;
  hrefFor: (row: CategoryRowView) => string;
  onMove: (from: number, to: number) => void;
  onOpen: (event: React.MouseEvent, row: CategoryRowView) => void;
  canEdit: boolean;
}) {
  const drag = useDragRows(onMove);
  if (rows.length === 0) return <p className="adm-cat-empty" data-tk="cat-empty">No categories yet. Use New category to add the first one.</p>;
  return (
    <ul className="adm-cat-rows" aria-label="Categories" data-tk="cat-list">
      {rows.map((row, index) => (
        <li key={row.id} className={`adm-cat-row${row.id === selectedId ? " is-selected" : ""}${drag.over === index ? " is-over" : ""}`} data-drag-row data-tk="cat-row" data-slug={row.slug} {...drag.rowProps(index)}>
          {canEdit ? (
            <span className="adm-cat-grip" aria-hidden="true" title="Drag to reorder" {...drag.handleProps(index)}>
              <GripVertical size={16} />
            </span>
          ) : null}
          <Link className="adm-cat-open" href={hrefFor(row)} aria-current={row.id === selectedId ? "page" : undefined} onClick={(event) => onOpen(event, row)}>
            {row.thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="adm-cat-thumb" src={row.thumb} alt="" loading="lazy" />
            ) : (
              <span className="adm-cat-thumb-empty" aria-hidden="true" data-tk="cat-thumb-empty" />
            )}
            <span className="adm-cat-name">
              <strong>{row.name}</strong>
              <small className={row.enabled ? undefined : "is-hidden"}>{row.enabled ? adsText(row.ads) : `Hidden · ${adsText(row.ads)}`}</small>
            </span>
          </Link>
          {canEdit ? <MoveButtons name={row.name} canUp={index > 0} canDown={index < rows.length - 1} onUp={() => onMove(index, index - 1)} onDown={() => onMove(index, index + 1)} /> : null}
        </li>
      ))}
    </ul>
  );
}
