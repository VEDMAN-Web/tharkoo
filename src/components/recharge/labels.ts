export function methodLabel(row: { method: string; coin: string | null; network: string | null }): string {
  if (row.method === "card") return "Card";
  return row.coin ? `Crypto ${row.coin}${row.network ? ` ${row.network}` : ""}` : "Crypto";
}
