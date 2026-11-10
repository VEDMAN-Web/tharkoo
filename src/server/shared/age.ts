/** Date-only values are interpreted as UTC midnight. */

export function parseDateOnly(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [yearText, monthText, dayText] = iso.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return null;
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

export function isAtLeast18(dateOfBirth: Date, now = new Date()): boolean {
  if (Number.isNaN(dateOfBirth.getTime())) return false;
  const eighteenth = new Date(
    Date.UTC(
      dateOfBirth.getUTCFullYear() + 18,
      dateOfBirth.getUTCMonth(),
      dateOfBirth.getUTCDate(),
    ),
  );
  return now.getTime() >= eighteenth.getTime();
}
