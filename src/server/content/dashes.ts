import { ValidationError } from "@/server/http";

/** Em dash and en dash, built from character codes so the source never contains either one (relay #42). */
export const DASH_CHARS = new RegExp("[" + String.fromCharCode(0x2014, 0x2013) + "]");

export const DASH_MESSAGE = "Use a comma, a colon or a full stop instead of a dash";

/** The top-level fields whose text contains an em or en dash. */
export function dashFields(fields: Record<string, unknown>): string[] {
  return Object.entries(fields)
    .filter(([, value]) => typeof value === "string" && DASH_CHARS.test(value))
    .map(([key]) => key);
}

/** Throws a ValidationError that names each field with a dash, with a clear message. */
export function assertNoDashes(fields: Record<string, unknown>): void {
  const bad = dashFields(fields);
  if (bad.length === 0) return;
  throw new ValidationError("Check the highlighted fields", Object.fromEntries(bad.map((key) => [key, [DASH_MESSAGE]])));
}
