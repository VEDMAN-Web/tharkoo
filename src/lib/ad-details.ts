
export type AdDetailRow = { label: string; value: string };

type DetailField = { key: string; label: string; order?: number; enabled?: boolean };

const MAX_ROWS = 8;

export function adDetailRows(attributes: unknown, fields: DetailField[] | undefined): AdDetailRow[] {
  if (!attributes || typeof attributes !== "object" || !fields?.length) return [];
  const bag = attributes as Record<string, unknown>;
  const ordered = [...fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const rows: AdDetailRow[] = [];
  for (const field of ordered) {
    if (field.enabled === false) continue;
    const raw = bag[field.key];
    const value = typeof raw === "boolean" ? (raw ? "Yes" : "") : typeof raw === "number" || typeof raw === "string" ? String(raw).trim() : "";
    if (!value) continue;
    rows.push({ label: field.label || field.key, value });
  }
  return rows.slice(0, MAX_ROWS);
}
