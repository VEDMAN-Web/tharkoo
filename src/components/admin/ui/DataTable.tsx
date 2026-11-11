"use client";

import { useMemo, useState } from "react";

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  /** Cell content; defaults to the plain value. */
  render?: (row: T) => React.ReactNode;
  /** Value used for sorting, filtering and CSV; defaults to `row[key]`. */
  value?: (row: T) => string | number | null | undefined;
}

function cellValue<T>(column: Column<T>, row: T): string | number | null | undefined {
  if (column.value) return column.value(row);
  const raw = (row as Record<string, unknown>)[column.key];
  return typeof raw === "string" || typeof raw === "number" ? raw : raw == null ? null : String(raw);
}

/** One CSV field. Cells that start with = + - @ get a leading quote so spreadsheets do not run them as formulas. */
export function csvField(value: string | number | null | undefined): string {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text) && Number.isNaN(Number(text))) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv<T>(columns: Column<T>[], rows: T[]): string {
  const head = columns.map((column) => csvField(column.label)).join(",");
  const body = rows.map((row) => columns.map((column) => csvField(cellValue(column, row))).join(","));
  return [head, ...body].join("\r\n");
}

const PAGE = 50;

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  csvName = "export",
  emptyText = "No rows yet",
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  csvName?: string;
  emptyText?: string;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [shown, setShown] = useState(PAGE);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const base = needle
      ? rows.filter((row) => columns.some((column) => String(cellValue(column, row) ?? "").toLowerCase().includes(needle)))
      : rows;
    if (!sort) return base;
    const column = columns.find((item) => item.key === sort.key);
    if (!column) return base;
    return [...base].sort((a, b) => {
      const left = cellValue(column, a);
      const right = cellValue(column, b);
      if (typeof left === "number" && typeof right === "number") return (left - right) * sort.dir;
      return String(left ?? "").localeCompare(String(right ?? ""), "en", { numeric: true }) * sort.dir;
    });
  }, [rows, columns, query, sort]);

  function exportCsv() {
    const blob = new Blob([toCsv(columns, filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${csvName}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="adm-table-tools">
        <input
          className="adm-input"
          style={{ maxWidth: 320 }}
          type="search"
          placeholder="Filter rows"
          aria-label="Filter rows"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setShown(PAGE);
          }}
        />
        <button type="button" className="adm-btn adm-btn-ghost" onClick={exportCsv} disabled={!filtered.length}>
          Export CSV
        </button>
      </div>
      {filtered.length ? (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key} aria-sort={sort?.key === column.key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
                    {column.sortable ? (
                      <button type="button" onClick={() => setSort((current) => (current?.key === column.key ? { key: column.key, dir: current.dir === 1 ? -1 : 1 } : { key: column.key, dir: 1 }))}>
                        {column.label}
                        {sort?.key === column.key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, shown).map((row) => (
                <tr key={rowKey(row)}>
                  {columns.map((column) => (
                    <td key={column.key} data-label={column.label}>
                      {column.render ? column.render(row) : String(cellValue(column, row) ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="adm-field-help">{rows.length ? "Nothing matches that filter." : emptyText}</p>
      )}
      {filtered.length > shown ? (
        <p style={{ marginTop: 12 }}>
          <button type="button" className="adm-btn adm-btn-quiet" onClick={() => setShown((count) => count + PAGE)}>
            Show {Math.min(PAGE, filtered.length - shown)} more
          </button>
        </p>
      ) : null}
    </div>
  );
}
