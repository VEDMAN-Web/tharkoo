"use client";

import Link from "next/link";
import type { PlaceRowView } from "@/server/locations/screen";
import { TYPE_NAME } from "./model";

/**
 * The list of places: the Home tile picture (a dashed box when there is none), the name, what kind of place it is and where,
 * "Hidden" in muted text. The row opens the place on the right. No drag handle: places are not reordered here.
 */
export function PlaceList({ rows, selectedId, hrefFor, onOpen, empty }: { rows: PlaceRowView[]; selectedId: string; hrefFor: (row: PlaceRowView) => string; onOpen: (event: React.MouseEvent, row: PlaceRowView) => void; empty: string }) {
  if (rows.length === 0) return <p className="adm-cat-empty" data-tk="place-empty">{empty}</p>;
  return (
    <ul className="adm-cat-rows" aria-label="Places" data-tk="place-list">
      {rows.map((row) => (
        <li key={row.id} className={`adm-cat-row${row.id === selectedId ? " is-selected" : ""}`} data-tk="place-row" data-slug={row.slug} data-type={row.type}>
          <Link className="adm-cat-open" href={hrefFor(row)} aria-current={row.id === selectedId ? "page" : undefined} onClick={(event) => onOpen(event, row)} style={{ paddingLeft: 10 }}>
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
        </li>
      ))}
    </ul>
  );
}
