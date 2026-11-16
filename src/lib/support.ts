export const SUPPORT_PHONE = "+91 912345678";
export const SUPPORT_HOURS = "9 am to 9 pm";
export const SUPPORT_TELEGRAM = "@tharkoo_support";

const MIN_PHONE_DIGITS = 8;

export function phoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function telHref(value: string): string {
  const digits = phoneDigits(value);
  if (digits.length < MIN_PHONE_DIGITS) return "";
  return `tel:${value.trim().startsWith("+") ? "+" : ""}${digits}`;
}

export function whatsappHref(value: string): string {
  const digits = phoneDigits(value);
  return digits.length < MIN_PHONE_DIGITS ? "" : `https://wa.me/${digits}`;
}

export function telegramHref(value: string): string {
  const user = value
    .trim()
    .replace(/^https?:\/\/t\.me\//i, "")
    .replace(/^@/, "")
    .replace(/[^\w]/g, "");
  return user ? `https://t.me/${user}` : "";
}
