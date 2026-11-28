import { ValidationError } from "@/server/http";

/** Most options one field can hold. Thousands are fine; the cap stops a runaway import. */
export const MAX_OPTIONS_PER_FIELD = 5000;
export const MAX_OPTION_LENGTH = 80;
/** Lines accepted from one bulk paste. */
export const MAX_LINES_PER_ADD = 1000;
/** Rows accepted from one CSV import. */
export const MAX_CSV_ROWS = 5000;

const CSV_HEADERS = new Set(["option", "options", "name", "value", "label"]);

export interface OptionRejection {
  line: number;
  reason: string;
}

export interface OptionReview {
  /** New values in the order they were pasted, trimmed, without duplicates inside this paste. */
  values: string[];
  /** Lines that repeat another line of the same paste (case-insensitive). */
  duplicates: number;
  rejected: OptionRejection[];
}

/** Trims, strips tags and control characters, and collapses spaces. Returns "" for anything that is not text. */
export function normalizeOption(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The key two options are compared by. "Ash brown" and "ash BROWN" are the same option. */
export function optionKey(value: string): string {
  return value.toLocaleLowerCase("en-IN");
}

/**
 * Checks one list of raw lines: blank lines are skipped, too-long and banned lines are rejected
 * (with the line number and a reason that never repeats the text), repeats are counted.
 */
export function reviewOptionCells(cells: readonly string[], limit = MAX_LINES_PER_ADD): OptionReview {
  if (cells.length > limit) {
    return { values: [], duplicates: 0, rejected: [{ line: 0, reason: `Add at most ${limit} lines at a time` }] };
  }
  const values: string[] = [];
  const seen = new Set<string>();
  const rejected: OptionRejection[] = [];
  let duplicates = 0;
  cells.forEach((raw, index) => {
    const value = normalizeOption(raw);
    if (!value) return;
    const line = index + 1;
    if (value.length > MAX_OPTION_LENGTH) {
      rejected.push({ line, reason: `Longer than ${MAX_OPTION_LENGTH} characters` });
      return;
    }
    const key = optionKey(value);
    if (seen.has(key)) {
      duplicates += 1;
      return;
    }
    seen.add(key);
    values.push(value);
  });
  return { values, duplicates, rejected };
}

/** Splits pasted text into lines. Windows and Unix line endings both work. */
export function pasteLines(text: string): string[] {
  return typeof text === "string" ? text.split(/\r?\n/) : [];
}

/** The first cell of one CSV line. Handles a quoted cell with "" for a quote. */
function firstCsvCell(line: string): string {
  if (!line.startsWith('"')) {
    const comma = line.indexOf(",");
    return comma === -1 ? line : line.slice(0, comma);
  }
  let out = "";
  let index = 1;
  while (index < line.length) {
    const char = line[index];
    if (char === '"') {
      if (line[index + 1] === '"') {
        out += '"';
        index += 2;
        continue;
      }
      break;
    }
    out += char;
    index += 1;
  }
  return out;
}

/**
 * The first column of a CSV file, one option per row. A header row such as "option" or "name" is dropped.
 * Only the first column is read: the rest of the row is ignored.
 */
export function csvFirstColumn(text: string): string[] {
  if (typeof text !== "string") return [];
  const rows = text.replace(/^﻿/, "").split(/\r?\n/).filter((line) => line.trim() !== "");
  if (rows.length > 0 && CSV_HEADERS.has(normalizeOption(firstCsvCell(rows[0])).toLowerCase())) rows.shift();
  return rows.map(firstCsvCell);
}

/** Options that are picked but not in the admin list. The server refuses the save when this is not empty. */
export function unlistedPicks(allowed: readonly string[], picks: readonly unknown[]): string[] {
  const listed = new Set(allowed);
  return picks.filter((pick) => typeof pick !== "string" || !listed.has(pick)).map((pick) => String(pick));
}

/** Refuses a field that would go past the cap, using the existing count and the new values. */
export function assertRoomFor(existingCount: number, incomingCount: number): void {
  if (existingCount + incomingCount > MAX_OPTIONS_PER_FIELD) {
    throw new ValidationError(`A field can hold at most ${MAX_OPTIONS_PER_FIELD} options`);
  }
}
