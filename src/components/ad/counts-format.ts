/** H6.17: whole numbers with Indian digit grouping: 999, 1,234, 12,345, 1,23,456, 12,34,567. */
export function viewsLabel(count: number): string {
  return count === 1 ? "view" : "views";
}

export function formatIndianCount(value: number): string {
  const digits = String(Math.max(0, Math.floor(Number.isFinite(value) ? value : 0)));
  if (digits.length <= 3) return digits;
  const last = digits.slice(-3);
  let rest = digits.slice(0, -3);
  const groups: string[] = [];
  while (rest.length > 2) {
    groups.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) groups.unshift(rest);
  return `${groups.join(",")},${last}`;
}
