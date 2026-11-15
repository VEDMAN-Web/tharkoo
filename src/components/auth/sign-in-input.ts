
export const CODE_LENGTH = 6;
export const INDIA_COUNTRY_CODE = "+91";

export function typedDigits(existing: string, raw: string): string {
  return raw.replace(/\D/g, "").replace(existing, "");
}

export function writeCodeDigits(value: string, index: number, digits: string): string {
  const at = Math.min(index, value.length);
  return (value.slice(0, at) + digits + value.slice(at + digits.length)).slice(0, CODE_LENGTH);
}

export function clearCodeDigit(value: string, index: number): string {
  return value.slice(0, index) + value.slice(index + 1);
}

export function backspaceCode(value: string, index: number): string {
  if (index <= 0) return value;
  return value.slice(0, index - 1) + value.slice(index);
}

export function focusIndexAfterWrite(value: string, index: number, digits: string): number {
  return Math.min(Math.min(index, value.length) + digits.length, CODE_LENGTH - 1);
}

export function indiaPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return `${INDIA_COUNTRY_CODE}${digits}`;
}

export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}
