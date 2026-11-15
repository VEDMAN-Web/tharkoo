/** Pure input rules for the sign-in card (H7.12). No React here, so the rules are unit-tested directly. */

export const CODE_LENGTH = 6;
export const INDIA_COUNTRY_CODE = "+91";

/**
 * The digits that a box keeps after a change. The box's old digit is dropped, so typing over it replaces it,
 * and a paste of several digits into one box comes through here too.
 */
export function typedDigits(existing: string, raw: string): string {
  return raw.replace(/\D/g, "").replace(existing, "");
}

/** Writes digits into the code from a box index on. The code never has a gap, so typing lands at the first empty box at most. */
export function writeCodeDigits(value: string, index: number, digits: string): string {
  const at = Math.min(index, value.length);
  return (value.slice(0, at) + digits + value.slice(at + digits.length)).slice(0, CODE_LENGTH);
}

/** Removes the digit in one box and closes the gap after it. */
export function clearCodeDigit(value: string, index: number): string {
  return value.slice(0, index) + value.slice(index + 1);
}

/** Backspace in an empty box removes the digit before it. Returns the code unchanged at the first box. */
export function backspaceCode(value: string, index: number): string {
  if (index <= 0) return value;
  return value.slice(0, index - 1) + value.slice(index);
}

/** The box that should take focus after digits were written at a box index. */
export function focusIndexAfterWrite(value: string, index: number, digits: string): number {
  return Math.min(Math.min(index, value.length) + digits.length, CODE_LENGTH - 1);
}

/** The mobile tab shows +91 in front. The number sent is +91 and the ten digits, with a leading 91 or 0 removed. */
export function indiaPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return `${INDIA_COUNTRY_CODE}${digits}`;
}

/** 30 becomes "0:30", 75 becomes "1:15". Used by the "Resend in" countdown. */
export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}
