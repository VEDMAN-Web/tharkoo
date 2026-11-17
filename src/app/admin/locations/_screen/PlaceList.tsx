"use client";

import Link from "next/link";
import { GripVertical } from "lucide-react";
import { MoveButtons } from "@/components/admin/ui";
import { useDragRows } from "@/components/admin/layout-editor/useDragRows";
import type { PlaceRowView } from "@/server/locations/screen";
import { TYPE_NAME } from "./model";

/**
 * The list of places: the Home tile picture (a dashed box when there is none), the name, what kind of place it is and where,
 * "Hidden" in muted text. The row opens the place on the right. No drag handle: places are not reordered here.
 */
export function PlaceList({ rows, selectedId, hrefFor, onOpen, onMove, canReorder, empty }: { rows: PlaceRowView[]; selectedId: string; hrefFor: (row: PlaceRowView) => string; onOpen: (event: React.MouseEvent, row: PlaceRowView) => void; onMove: (from: number, to: number) => void; canReorder: boolean; empty: string }) {
  const drag = useDragRows((from, to) => {
    if (rows[from] && rows[to] && rows[from].type === rows[to].type) onMove(from, to);
  });
  if (rows.length === 0) return <p className="adm-cat-empty" data-tk="place-empty">{empty}</p>;
  return (
    <ul className="adm-cat-rows" aria-label="Places" data-tk="place-list">
      {rows.map((row, index) => (
        <li key={row.id} className={`adm-cat-row${row.id === selectedId ? " is-selected" : ""}${drag.over === index ? " is-over" : ""}`} data-drag-row data-tk="place-row" data-slug={row.slug} data-type={row.type} {...drag.rowProps(index)}>
          {canReorder ? (
            <span className="adm-cat-grip" aria-hidden="true" title="Drag to reorder" data-tk="place-grip" {...drag.handleProps(index)}>
              <GripVertical size={16} />
            </span>
          ) : null}
          <Link className="adm-cat-open" href={hrefFor(row)} aria-current={row.id === selectedId ? "page" : undefined} onClick={(event) => onOpen(event, row)} style={canReorder ? undefined : { paddingLeft: 10 }}>
            {row.thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="adm-cat-thumb" src={row.thumb} alt="" loading="lazy" />
            ) : (
              <span className="adm-cat-thumb-empty" aria-hidden="true" data-tk="place-thumb-empty" />
            )}
            <span className="adm-cat-name">
              <strong>{row.name}</strong>
              <small className={row.enabled ? undefined : "is-hidden"}>{`${row.enabled ? "" : "Hidden · "}${TYPE_NAME[row.type]}${row.where ? ` in ${row.where}` : ""}`}</small>
            </span>
          </Link>
          {canReorder ? <MoveButtons name={row.name} canUp={index > 0 && rows[index - 1].type === row.type} canDown={index < rows.length - 1 && rows[index + 1].type === row.type} onUp={() => onMove(index, index - 1)} onDown={() => onMove(index, index + 1)} /> : null}
        </li>
      ))}
    </ul>
  );
}
