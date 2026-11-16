"use client";

import { useEffect, useRef } from "react";
import "@/styles/admin-kit.css";
import { Button } from "./Button";
import { PAGE_SIZES, pageRange, rangeLabel, selectionState, toggleAllOnPage, toggleOne } from "./kit-helpers";

export type TableColumn<T> = {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  /** The main thing: title with one sub line. It opens the row, and is the only cell shown first on a phone card. */
  primary?: boolean;
  /** Owner, city and extra data: hidden on a phone card. */
  hideOnPhone?: boolean;
  nowrap?: boolean;
};

/**
 * A server-paginated table (UI-RULES section 4). Column order is yours: select, main thing, status, other data, time, row actions.
 * Rows select with a checkbox; when one or more are selected the bulk bar replaces the header in the same place.
 * The row opens on a click of its main thing (and on Enter). Under 768 px rows become cards and the checkbox column is hidden.
 * Paging, sorting and filtering stay on the server: pass the rows of the current page and the total.
 */
export function ServerTable<T>({
  label,
  columns,
  rows,
  rowId,
  rowLabel,
  total,
  page,
  pageSize,
  onPage,
  onPageSize,
  loading = false,
  loadingText = "Loading",
  empty,
  selectable = false,
  selected = [],
  onSelected,
  bulkActions,
  openId,
  onOpen,
  rowActions,
}: {
  label: string;
  columns: TableColumn<T>[];
  rows: T[];
  rowId: (row: T) => string;
  /** A short name for the row, used in the checkbox label: "Select Study table, teak". */
  rowLabel: (row: T) => string;
  total: number;
  page: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  loading?: boolean;
  loadingText?: string;
  /** Shown instead of the rows when there are none: use an EmptyState with one action. */
  empty?: React.ReactNode;
  selectable?: boolean;
  selected?: string[];
  onSelected?: (ids: string[]) => void;
  /** Buttons for the bulk bar, destructive one rightmost. */
  bulkActions?: React.ReactNode;
  openId?: string | null;
  onOpen?: (row: T) => void;
  /** At most 2 buttons per row (queues: Approve, Reject). Everything else lives in the drawer. */
  rowActions?: (row: T) => React.ReactNode;
}) {
  const pageIds = rows.map(rowId);
  const state = selectionState(selected, pageIds);
  const allBox = useRef<HTMLInputElement>(null);
  const range = pageRange(total, page, pageSize);
  const hasSelection = selectable && selected.length > 0;

  useEffect(() => {
    if (allBox.current) allBox.current.indeterminate = state === "some";
  }, [state]);

  const empty0 = !loading && rows.length === 0;
  return (
    <div className="adm-k-tablewrap" data-tk="server-table" aria-busy={loading || undefined}>
      {hasSelection ? (
        <div className="adm-k-bulk" role="region" aria-label="Selected rows" data-tk="bulk-bar">
          <input
            type="checkbox"
            className="adm-k-check"
            checked
            aria-label="Clear the selection"
            onChange={() => onSelected?.([])}
          />
          <strong data-tk="bulk-count">{selected.length.toLocaleString("en-IN")} selected</strong>
          <Button kind="quiet" size="sm" onClick={() => onSelected?.([])}>
            Clear
          </Button>
          <span className="adm-k-sp" />
          {bulkActions}
        </div>
      ) : null}
      <div className="adm-k-tablescroll">
        <table className="adm-k-table" aria-label={label}>
          <thead hidden={hasSelection}>
            <tr>
              {selectable ? (
                <th className="adm-k-cbx" scope="col">
                  <input
                    ref={allBox}
                    type="checkbox"
                    className="adm-k-check"
                    checked={state === "all"}
                    aria-label="Select all rows on this page"
                    onChange={() => onSelected?.(toggleAllOnPage(selected, pageIds))}
                  />
                </th>
              ) : null}
              {columns.map((column) => (
                <th key={column.key} scope="col" className={column.hideOnPhone ? "adm-k-hide-phone" : undefined}>
                  {column.header}
                </th>
              ))}
              {rowActions ? <th scope="col" className="adm-k-actions-h"><span className="adm-k-sr">Actions</span></th> : null}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }, (_, index) => (
                  <tr key={`sk-${index}`} className="adm-k-skel-row" aria-hidden="true">
                    <td colSpan={columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)}>
                      <span className="adm-k-skel" style={{ width: `${70 - index * 8}%` }} />
                    </td>
                  </tr>
                ))
              : rows.map((row) => {
                  const id = rowId(row);
                  const isOpen = openId === id;
                  const isChecked = selected.includes(id);
                  return (
                    <tr key={id} data-open={isOpen ? "yes" : undefined} data-checked={isChecked ? "yes" : undefined} aria-selected={selectable ? isChecked : undefined}>
                      {selectable ? (
                        <td className="adm-k-cbx">
                          <input
                            type="checkbox"
                            className="adm-k-check"
                            checked={isChecked}
                            aria-label={`Select ${rowLabel(row)}`}
                            onChange={() => onSelected?.(toggleOne(selected, id))}
                          />
                        </td>
                      ) : null}
                      {columns.map((column) => (
                        <td key={column.key} className={[column.hideOnPhone ? "adm-k-hide-phone" : "", column.nowrap ? "adm-k-nowrap" : "", column.primary ? "adm-k-main" : ""].filter(Boolean).join(" ") || undefined} data-label={column.header}>
                          {column.primary && onOpen ? (
                            <button type="button" className="adm-k-rowlink" aria-expanded={isOpen} onClick={() => onOpen(row)}>
                              {column.cell(row)}
                            </button>
                          ) : (
                            column.cell(row)
                          )}
                        </td>
                      ))}
                      {rowActions ? <td className="adm-k-rowact">{rowActions(row)}</td> : null}
                    </tr>
                  );
                })}
          </tbody>
        </table>
        {loading ? <p className="adm-k-sr" role="status">{loadingText}</p> : null}
        {empty0 ? <div data-tk="table-empty">{empty}</div> : null}
      </div>
      <div className="adm-k-pager" data-tk="pager">
        <span data-tk="pager-range">{rangeLabel(total, page, pageSize)}</span>
        <label className="adm-k-pagesize">
          <span className="adm-k-sr">Rows per page</span>
          <select className="adm-k-select" value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))}>
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size} per page
              </option>
            ))}
          </select>
        </label>
        <span className="adm-k-sp" />
        <Button size="sm" disabled={range.page <= 1} onClick={() => onPage(range.page - 1)}>
          Previous
        </Button>
        <Button size="sm" disabled={range.page >= range.pages} onClick={() => onPage(range.page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
