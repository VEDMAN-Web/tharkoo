export const BULK_MAX = 100;
export const BULK_TYPED_FROM = 50;

/** The lengths the Extend choice offers, in hours: 24 h, 48 h, 7 days, 30 days. */
export const EXTEND_HOURS = [24, 48, 168, 720] as const;
export const EXTEND_CHOICES: readonly { hours: number; label: string }[] = [
  { hours: 24, label: "+24 hours" },
  { hours: 48, label: "+48 hours" },
  { hours: 168, label: "+7 days" },
  { hours: 720, label: "+30 days" },
];

/** "Expire in ..." sets the end to now plus this many hours. */
export const EXPIRE_IN_HOURS = [24] as const;

/** An end time set by hand may be at most this far ahead. */
export const SET_END_MAX_DAYS = 365;

/** Words for a change of end time, for the toast. */
export function extendWord(hours: number): string {
  return EXTEND_CHOICES.find((choice) => choice.hours === hours)?.label.replace("+", "Extended by ") ?? `Extended by ${hours} hours`;
}
