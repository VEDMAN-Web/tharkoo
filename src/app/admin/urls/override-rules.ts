// Pure rules for per-URL SEO overrides: validation, CSV parsing and diffing.
// No database here, so the editor (client) and the server share the same checks.
import { cleanPath } from "@/lib/urls";
import { textDenied } from "@/server/shared/policy";

export const OVERRIDE_LIMITS = { title: 120, description: 320, h1: 120, intro: 1500, canonical: 300, ogImage: 500, faqQ: 200, faqA: 1000, faqCount: 8 } as const;
export const MAX_CSV_ROWS = 500;
export const CSV_COLUMNS = ["path", "title", "description", "h1", "robots"] as const;

export interface FaqPair {
  q: string;
  a: string;
}

export interface OverrideInput {
  path: string;
  title?: string;
  description?: string;
  h1?: string;
  canonical?: string;
  /** "noindex" or "index"; ignored when `noindex` is given. */
  robots?: string;
  noindex?: boolean;
  ogImage?: string;
  intro?: string;
  faq?: { q?: string; a?: string }[];
}

export interface OverrideClean {
  path: string;
  title: string;
  description: string;
  h1: string;
  canonical: string;
  noindex: boolean;
  ogImage: string;
  intro: string;
  faq: FaqPair[];
}

export type OverrideResult = { ok: true; value: OverrideClean } | { ok: false; errors: Record<string, string> };

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

function text(value: unknown) {
  return typeof value === "string" ? value.replace(CONTROL, "").replace(/<[^>]*>/g, "").trim() : "";
}

function safeUrlOrPath(value: string, origin: string) {
  if (!value) return true;
  if (/\s/.test(value)) return false;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? (origin ? url.origin === new URL(origin).origin : true) : false;
  } catch {
    return false;
  }
}

function imageOk(value: string) {
  if (!value) return true;
  if (/\s/.test(value)) return false;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** Cleans one override and lists every problem by field. `origin` is the site address, used for the canonical check. */
export function normalizeOverride(input: OverrideInput, origin = ""): OverrideResult {
  const errors: Record<string, string> = {};
  const rawPath = text(input.path);
  if (!rawPath || rawPath.length > 300 || /\s/.test(rawPath) || rawPath.includes("://")) errors.path = "Enter a page address such as /jobs/pune/";
  const value: OverrideClean = {
    path: cleanPath(rawPath || "/"),
    title: text(input.title),
    description: text(input.description),
    h1: text(input.h1),
    canonical: text(input.canonical),
    noindex: input.noindex ?? text(input.robots).toLowerCase() === "noindex",
    ogImage: text(input.ogImage),
    intro: text(input.intro),
    faq: [],
  };
  const robots = text(input.robots).toLowerCase();
  if (input.noindex === undefined && robots && robots !== "index" && robots !== "noindex") errors.robots = "Use index or noindex";
  for (const key of ["title", "description", "h1", "intro"] as const) {
    if (value[key].length > OVERRIDE_LIMITS[key]) errors[key] = `Keep this to ${OVERRIDE_LIMITS[key]} characters or fewer`;
    else if (value[key] && textDenied(value[key]).denied) errors[key] = "This text contains a word that is not allowed on Tharkoo";
  }
  if (value.canonical.length > OVERRIDE_LIMITS.canonical || !safeUrlOrPath(value.canonical, origin)) {
    errors.canonical = "Use a path such as /jobs/ or a full address on this site";
  }
  if (value.ogImage.length > OVERRIDE_LIMITS.ogImage || !imageOk(value.ogImage)) errors.ogImage = "Use an image from the media library or an https address";
  const faq = (input.faq ?? []).map((item) => ({ q: text(item?.q), a: text(item?.a) })).filter((item) => item.q || item.a);
  if (faq.length > OVERRIDE_LIMITS.faqCount) errors.faq = `At most ${OVERRIDE_LIMITS.faqCount} questions`;
  for (const item of faq) {
    if (!item.q || !item.a) errors.faq = "Each question needs an answer";
    else if (item.q.length > OVERRIDE_LIMITS.faqQ || item.a.length > OVERRIDE_LIMITS.faqA) errors.faq = "A question or answer is too long";
    else if (textDenied(item.q).denied || textDenied(item.a).denied) errors.faq = "A question or answer contains a word that is not allowed on Tharkoo";
  }
  value.faq = faq;
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}

/** Minimal CSV reader: quoted fields, doubled quotes, CRLF or LF. */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const body = input.replace(/^﻿/, "");
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && body[i + 1] === "\n") i += 1;
      row.push(cell);
      cell = "";
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

export interface CsvRow {
  line: number;
  input: OverrideInput;
}

export function overrideRowsFromCsv(csv: string): { rows: CsvRow[]; errors: string[] } {
  const table = parseCsv(csv);
  if (table.length === 0) return { rows: [], errors: ["The file is empty"] };
  const header = table[0].map((name) => name.trim().toLowerCase());
  const index = (name: string) => header.indexOf(name);
  if (index("path") < 0) return { rows: [], errors: ["The first row must have a path column: path,title,description,h1,robots"] };
  if (table.length - 1 > MAX_CSV_ROWS) return { rows: [], errors: [`At most ${MAX_CSV_ROWS} rows per file`] };
  const rows: CsvRow[] = table.slice(1).map((cells, i) => {
    const pick = (name: string) => (index(name) >= 0 ? (cells[index(name)] ?? "") : undefined);
    return {
      line: i + 2,
      input: { path: pick("path") ?? "", title: pick("title"), description: pick("description"), h1: pick("h1"), robots: pick("robots") },
    };
  });
  return { rows, errors: [] };
}

function csvCell(value: string) {
  let out = value;
  if (/^[=+\-@\t\r]/.test(out)) out = `'${out}`;
  return /[",\n\r]/.test(out) ? `"${out.replace(/"/g, '""')}"` : out;
}

export function overridesToCsv(rows: { path: string; title: string; description: string; h1: string; noindex: boolean }[]) {
  const lines = rows.map((row) => [row.path, row.title, row.description, row.h1, row.noindex ? "noindex" : "index"].map(csvCell).join(","));
  return [CSV_COLUMNS.join(","), ...lines].join("\r\n");
}

export type DiffStatus = "new" | "changed" | "same";

const DIFF_FIELDS = ["title", "description", "h1", "noindex"] as const;

/** What an import would change. Only fields that came from the file are compared. */
export function diffOverride(existing: OverrideClean | null, next: OverrideClean, touched: readonly string[]): { status: DiffStatus; changes: string[] } {
  if (!existing) return { status: "new", changes: touched.filter((name) => next[name as keyof OverrideClean] !== "" && next[name as keyof OverrideClean] !== false).map((name) => `${name}: set`) };
  const changes: string[] = [];
  for (const name of DIFF_FIELDS) {
    if (!touched.includes(name)) continue;
    if (existing[name] !== next[name]) {
      changes.push(name === "noindex" ? `robots: ${existing.noindex ? "noindex" : "index"} -> ${next.noindex ? "noindex" : "index"}` : `${name}: "${existing[name]}" -> "${next[name]}"`);
    }
  }
  return { status: changes.length ? "changed" : "same", changes };
}
