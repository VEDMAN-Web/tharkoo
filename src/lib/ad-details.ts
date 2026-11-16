export type AdDetailRow = { label: string; value: string };

type DetailField = { key: string; label: string; type?: string; unit?: string; order?: number; enabled?: boolean };

const MONEY_KEY = /(price|rent|salary|deposit|amount|fee)/i;
const MONEY_UNIT = /^(₹|rs[.]?|inr)$/i;
const YEAR_KEY = /year|^age$/i;
const PLAIN_NUMBER = /^[\s]*-?[0-9]+([.][0-9]+)?[\s]*$/;

function numericValue(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string" || !PLAIN_NUMBER.test(raw)) return null;
  return Number(raw);
}

function formatNumber(amount: number, field: DetailField): string {
  const unit = (field.unit || "").trim();
  if (YEAR_KEY.test(field.key) || (!unit && Number.isInteger(amount) && amount >= 1900 && amount <= 2100)) return String(amount);
  const grouped = amount.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  if (MONEY_UNIT.test(unit) || (MONEY_KEY.test(field.key) && !unit)) return `₹ ${grouped}`;
  return unit ? `${grouped} ${unit}` : grouped;
}

const MAX_ROWS = 8;

export function adDetailRows(attributes: unknown, fields: DetailField[] | undefined): AdDetailRow[] {
  if (!attributes || typeof attributes !== "object" || !fields?.length) return [];
  const bag = attributes as Record<string, unknown>;
  const ordered = [...fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const rows: AdDetailRow[] = [];
  for (const field of ordered) {
    if (field.enabled === false) continue;
    const raw = bag[field.key];
    const amount = field.type === "number" || typeof raw === "number" ? numericValue(raw) : null;
    const value = amount !== null ? formatNumber(amount, field) : typeof raw === "boolean" ? (raw ? "Yes" : "") : typeof raw === "number" || typeof raw === "string" ? String(raw).trim() : "";
    if (!value) continue;
    rows.push({ label: field.label || field.key, value });
  }
  return rows.slice(0, MAX_ROWS);
}
