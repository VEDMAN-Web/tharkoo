/**
 * H16.1: reading the cities and areas CSV files. Pure text work (no database): split the file into rows, check the header,
 * and clean each row into a plain object. Whether a row is new, already there or wrong for THIS site is decided in import.ts.
 */

export const MAX_CSV_BYTES = 800_000;
export const MAX_CSV_ROWS = 5000;
export const MAX_NAME = 80;

export const CITY_HEADER = ["name", "state", "slug", "isDistrictHq", "population", "source"] as const;
export const AREA_HEADER = ["city", "name", "slug"] as const;

export type CityRow = { line: number; name: string; state: string; slug: string; isDistrictHq: boolean; population: number | null; source: string };
export type AreaRow = { line: number; city: string; name: string; slug: string };
export type RowProblem = { line: number; name: string; message: string };

/** RFC 4180: commas, double quotes, "" for a quote inside quotes, and line breaks inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const body = text.replace(/^﻿/, "");
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"') {
        if (body[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"' && cell === "") quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && body[i + 1] === "\n") i += 1;
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((items) => items.some((item) => item.trim() !== ""));
}

export type TableResult<T> = { ok: true; rows: T[] } | { ok: false; message: string };

function tableOf(text: string, header: readonly string[], required: readonly string[]): { ok: true; index: Map<string, number>; body: { line: number; cells: string[] }[] } | { ok: false; message: string } {
  if (text.length > MAX_CSV_BYTES) return { ok: false, message: "This file is too big. Keep it under 800 KB." };
  const all = parseCsv(text);
  if (all.length === 0) return { ok: false, message: "The file is empty." };
  const names = all[0].map((item) => item.trim());
  const index = new Map(names.map((item, position) => [item.toLowerCase(), position]));
  const missing = required.filter((item) => !index.has(item.toLowerCase()));
  if (missing.length > 0) return { ok: false, message: `The first line must name the columns: ${header.join(", ")}. Missing: ${missing.join(", ")}.` };
  if (all.length - 1 > MAX_CSV_ROWS) return { ok: false, message: `This file has more than ${MAX_CSV_ROWS.toLocaleString("en-IN")} rows. Split it into smaller files.` };
  return { ok: true, index, body: all.slice(1).map((cells, position) => ({ line: position + 2, cells })) };
}

/** One text cell: no markup characters, no control characters, one space between words. */
export function cleanCell(value: string | undefined): string {
  return (value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

export function readCityTable(text: string): TableResult<CityRow> {
  const table = tableOf(text, CITY_HEADER, ["name", "state", "slug"]);
  if (!table.ok) return table;
  const at = (cells: string[], key: string) => cleanCell(cells[table.index.get(key.toLowerCase()) ?? -1]);
  return {
    ok: true,
    rows: table.body.map(({ line, cells }) => {
      const raw = at(cells, "population").replace(/[,\s]/g, "");
      return {
        line,
        name: at(cells, "name"),
        state: at(cells, "state"),
        slug: at(cells, "slug").toLowerCase(),
        isDistrictHq: /^(yes|true|1|y)$/i.test(at(cells, "isDistrictHq")),
        population: /^\d{1,10}$/.test(raw) ? Number(raw) : null,
        source: at(cells, "source"),
      };
    }),
  };
}

export function readAreaTable(text: string): TableResult<AreaRow> {
  const table = tableOf(text, AREA_HEADER, ["city", "name", "slug"]);
  if (!table.ok) return table;
  const at = (cells: string[], key: string) => cleanCell(cells[table.index.get(key.toLowerCase()) ?? -1]);
  return { ok: true, rows: table.body.map(({ line, cells }) => ({ line, city: at(cells, "city"), name: at(cells, "name"), slug: at(cells, "slug").toLowerCase() })) };
}

/** Problems that need no database: a missing or too long name, markup in a name, a bad web address, a bad population number. */
export function shapeProblem(row: { name: string; slug: string }, validate: (slug: string) => { ok: boolean; message?: string; slug?: string }): string {
  if (!row.name) return "The name is empty.";
  if (row.name.length > MAX_NAME) return `The name is longer than ${MAX_NAME} characters.`;
  if (/[<>]/.test(row.name)) return "The name has characters that are not allowed.";
  if (!row.slug) return "The web address is empty.";
  const checked = validate(row.slug);
  if (!checked.ok) return `The web address "${row.slug}" cannot be used: ${checked.message ?? "invalid"}`;
  // validateSlug tidies what it is given, but a file must already hold the tidy form, so the address on the site is exactly the one in the file.
  if (checked.slug !== row.slug) return `The web address "${row.slug}" cannot be used: write it as lowercase words joined by hyphens, like "${checked.slug}".`;
  return "";
}
