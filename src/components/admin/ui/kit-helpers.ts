/** H8.2 (A2): pure helpers behind the kit components, so the rules can be tested without a browser. */

export const UNDO_TOAST_MS = 10_000;
export const SUCCESS_TOAST_MS = 4_000;
export const BOTTOM_BAR_MAX = 5;

export type ToastKind = "success" | "undo" | "error";

/** Undo toasts last 10 s, success toasts 4 s, an error stays until it is closed (null). */
export function toastDuration(kind: ToastKind): number | null {
  if (kind === "undo") return UNDO_TOAST_MS;
  if (kind === "success") return SUCCESS_TOAST_MS;
  return null;
}

/** Time left on a toast. `elapsedMs` counts only the time it was not paused by hover or focus. */
export function toastRemaining(durationMs: number | null, elapsedMs: number): number | null {
  if (durationMs === null) return null;
  return Math.max(0, durationMs - Math.max(0, elapsedMs));
}

/** The number shown beside Undo: whole seconds, rounded up. */
export function countdownSeconds(remainingMs: number): number {
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

/** Typed confirm: the exact text, after trimming spaces at the ends. */
export function typedConfirmMatches(typed: string, expected: string): boolean {
  return expected.length > 0 && typed.trim() === expected;
}

export type ReasonCheck = {
  reasons: readonly string[];
  /** A reason from the list is required (the list is shown). */
  requireReason: boolean;
  /** Free text is required, either alone or after "Other". */
  requireText: boolean;
  pickedReason: string;
  text: string;
  minText?: number;
  typedConfirm?: string;
  typed?: string;
};

export type ReasonErrors = { reason?: string; text?: string; typed?: string };

/** What is missing before a reason dialog may confirm. Messages start with what to do. */
export function validateReason(check: ReasonCheck): { ok: boolean; errors: ReasonErrors } {
  const errors: ReasonErrors = {};
  if (check.requireReason && check.reasons.length > 0 && !check.reasons.includes(check.pickedReason)) errors.reason = "Choose a reason.";
  const min = check.minText ?? 3;
  const needsText = check.requireText || check.pickedReason === "Other";
  if (needsText && check.text.trim().length < min) errors.text = `Write at least ${min} characters.`;
  if (check.typedConfirm !== undefined && !typedConfirmMatches(check.typed ?? "", check.typedConfirm)) errors.typed = `Type ${check.typedConfirm} to confirm.`;
  return { ok: Object.keys(errors).length === 0, errors };
}

/** The phone bottom bar shows at most 5 items. */
export function bottomBarItems<T>(items: readonly T[]): T[] {
  return items.slice(0, BOTTOM_BAR_MAX);
}

/** Moves one item up or down in a list without changing the original. Out of range returns the same order. */
export function moveItem<T>(items: readonly T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return [...items];
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** A button label that ends with "..." opens a dialog or a picker first (UI-RULES section 2). */
export function opensDialog(label: string): boolean {
  return /(\.\.\.|…)$/.test(label.trim());
}

/* ---- H8.4 (A4): tables, selection, history diff, media, record forms ---- */

export const PAGE_SIZES = [25, 50, 100] as const;

/** Page maths for a server-paginated list. The page is kept inside 1 to the last page. */
export function pageRange(total: number, page: number, pageSize: number): { page: number; pages: number; from: number; to: number } {
  const size = Math.max(1, Math.floor(pageSize));
  const pages = Math.max(1, Math.ceil(Math.max(0, total) / size));
  const current = Math.min(pages, Math.max(1, Math.floor(page) || 1));
  const from = total <= 0 ? 0 : (current - 1) * size + 1;
  const to = Math.min(Math.max(0, total), current * size);
  return { page: current, pages, from, to };
}

/** "1 to 25 of 8,231" (UI-RULES section 4). */
export function rangeLabel(total: number, page: number, pageSize: number): string {
  const { from, to } = pageRange(total, page, pageSize);
  return `${from.toLocaleString("en-IN")} to ${to.toLocaleString("en-IN")} of ${Math.max(0, total).toLocaleString("en-IN")}`;
}

export type SelectionState = "none" | "some" | "all";

/** Whether none, some or all of the rows on this page are selected. */
export function selectionState(selected: readonly string[], pageIds: readonly string[]): SelectionState {
  if (pageIds.length === 0) return "none";
  const chosen = pageIds.filter((id) => selected.includes(id)).length;
  return chosen === 0 ? "none" : chosen === pageIds.length ? "all" : "some";
}

/** Select-all on a page: selects every row, or when all are selected already, clears this page. Other pages stay as they were. */
export function toggleAllOnPage(selected: readonly string[], pageIds: readonly string[]): string[] {
  if (selectionState(selected, pageIds) === "all") return selected.filter((id) => !pageIds.includes(id));
  return [...selected, ...pageIds.filter((id) => !selected.includes(id))];
}

export function toggleOne(selected: readonly string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];
}

export type DiffKind = "added" | "removed" | "changed";
export type DiffRow = { path: string; kind: DiffKind; before: string; after: string };

function isPlain(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

/** How a value reads in a diff: text as it is, everything else as JSON. Empty or missing is an empty string. */
export function diffValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return JSON.stringify(value);
}

/** Field-level difference between two records. Nested objects are walked with a dotted path; arrays compare as a whole. */
export function diffFields(before: unknown, after: unknown, prefix = ""): DiffRow[] {
  const left = isPlain(before) ? before : {};
  const right = isPlain(after) ? after : {};
  const keys = Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).sort();
  const rows: DiffRow[] = [];
  for (const key of keys) {
    const path = prefix ? `${prefix}.${key}` : key;
    const a = left[key];
    const b = right[key];
    if (isPlain(a) && isPlain(b)) {
      rows.push(...diffFields(a, b, path));
      continue;
    }
    const x = diffValue(a);
    const y = diffValue(b);
    if (x === y) continue;
    const kind: DiffKind = a === undefined || a === null ? "added" : b === undefined || b === null ? "removed" : "changed";
    rows.push({ path, kind, before: x, after: y });
  }
  return rows;
}

export const ALT_MAX = 125;

export type MediaValueLike = { image: { src: string; alt: string } | null };

/** What stops a picture from being saved: none chosen when required, or no picture description (alt text). */
export function mediaProblems(value: MediaValueLike, options: { required?: boolean } = {}): { image?: string; alt?: string } {
  const problems: { image?: string; alt?: string } = {};
  if (!value.image) {
    if (options.required) problems.image = "Choose a picture.";
    return problems;
  }
  const alt = value.image.alt.trim();
  if (alt.length === 0) problems.alt = "Describe the picture in a few words (alt text).";
  else if (alt.length > ALT_MAX) problems.alt = `Shorten the description to ${ALT_MAX} characters.`;
  return problems;
}

/** Turns zod issues into one message per field name (the first issue of each). */
export function fieldErrors(issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const name = String(issue.path[0] ?? "");
    if (name && !(name in errors)) errors[name] = issue.message;
  }
  return errors;
}

/** The names of the fields that differ between two value sets, for "3 unsaved changes: Title, Price". */
export function changedFields(initial: Record<string, unknown>, current: Record<string, unknown>): string[] {
  return Object.keys({ ...initial, ...current }).filter((key) => JSON.stringify(initial[key] ?? null) !== JSON.stringify(current[key] ?? null));
}
