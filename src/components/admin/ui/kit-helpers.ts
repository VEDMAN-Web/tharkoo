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
