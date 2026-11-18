/**
 * H14.3: the pure parts of the seller dashboard. Days are Asia/Kolkata days (UTC+05:30, no daylight saving), a week is
 * Monday to Sunday there. Nothing here reads the database, so a test can feed it seeded numbers.
 */
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
const IST_OFFSET = 5 * HOUR + 30 * MINUTE;

export const GOAL_MIN = 50;
export const GOAL_MAX = 1_000_000;
export const GOAL_DEFAULT_MIN = 100;
const GOAL_FACTOR = 1.2;
const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10];

export const MILESTONES = [
  { key: "views100", kind: "views", target: 100 },
  { key: "views1000", kind: "views", target: 1000 },
  { key: "clicks100", kind: "clicks", target: 100 },
  { key: "views5000", kind: "views", target: 5000 },
] as const;

/** 00:00 in India on the day that holds `at`. */
export function istDayStart(at: Date): Date {
  return new Date(Math.floor((at.getTime() + IST_OFFSET) / DAY) * DAY - IST_OFFSET);
}

/** "2026-11-18": the India day that holds `at`. The same text Mongo gives with timezone Asia/Kolkata. */
export function istDayKey(at: Date): string {
  return new Date(at.getTime() + IST_OFFSET).toISOString().slice(0, 10);
}

/** Monday 00:00 in India of the week that holds `at`. */
export function istWeekStart(at: Date): Date {
  const dayStart = istDayStart(at);
  const weekday = new Date(dayStart.getTime() + IST_OFFSET).getUTCDay();
  return new Date(dayStart.getTime() - ((weekday + 6) % 7) * DAY);
}

export type DayCell = { key: string; start: Date; label: string };

/** The `count` India days that end with today, oldest first, with a label such as "Wed 18". */
export function lastDays(now: Date, count: number): DayCell[] {
  const today = istDayStart(now).getTime();
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return Array.from({ length: count }, (_, index) => {
    const start = new Date(today - (count - 1 - index) * DAY);
    const shifted = new Date(start.getTime() + IST_OFFSET);
    return { key: istDayKey(start), start, label: `${weekdays[shifted.getUTCDay()]} ${shifted.getUTCDate()}` };
  });
}

/** The change from `previous` to `current` in whole percent, or null when there was nothing before to compare with. */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Rounds up to a number a person would pick: 100, 150, 200, 250, 300, 400, 500, 600, 750, 800, 1,000 ... */
export function niceNumberUp(value: number): number {
  if (value <= 1) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of NICE_STEPS) {
    const candidate = Math.round(step * power);
    if (candidate >= value) return candidate;
  }
  return power * 10;
}

/** Last week's views x 1.2, rounded up to a nice number, at least 100 and at most 1,000,000. */
export function defaultGoal(lastWeekViews: number): number {
  const wanted = Math.max(GOAL_DEFAULT_MIN, niceNumberUp(Math.max(0, lastWeekViews) * GOAL_FACTOR));
  return Math.min(GOAL_MAX, wanted);
}

/** A goal a person typed: a whole number from 50 to 1,000,000, else null. */
export function cleanGoal(value: unknown): number | null {
  const number = typeof value === "string" ? Number(value.replace(/[,\s]/g, "")) : value;
  if (typeof number !== "number" || !Number.isFinite(number) || !Number.isInteger(number)) return null;
  return number >= GOAL_MIN && number <= GOAL_MAX ? number : null;
}

export type Goal = { goal: number; views: number; remaining: number; percent: number; daysLeft: number; isDefault: boolean };

export function goalProgress(input: { saved: number | null | undefined; weekViews: number; lastWeekViews: number; now: Date }): Goal {
  const saved = input.saved && input.saved >= GOAL_MIN && input.saved <= GOAL_MAX ? input.saved : null;
  const goal = saved ?? defaultGoal(input.lastWeekViews);
  const nextWeek = istWeekStart(input.now).getTime() + 7 * DAY;
  return {
    goal,
    views: input.weekViews,
    remaining: Math.max(0, goal - input.weekViews),
    percent: Math.min(100, Math.round((input.weekViews / goal) * 100)),
    daysLeft: Math.max(1, Math.ceil((nextWeek - input.now.getTime()) / DAY)),
    isDefault: saved === null,
  };
}

export type Lift = { times: number; during: number; before: number; now: number; endedDaysAgo: number };

/**
 * What a TOP boost did, from real view counts: views a day while it ran, views a day in the 7 days before it, and
 * views a day since it ended. Only a real gain counts: no views before, or no more views during, means no lift.
 */
export function liftOf(input: { duringViews: number; duringMs: number; beforeViews: number; sinceViews: number; endsAt: Date; now: Date }): Lift | null {
  const duringDays = Math.max(1, input.duringMs / DAY);
  const during = input.duringViews / duringDays;
  const before = input.beforeViews / 7;
  if (before <= 0 || during <= before) return null;
  const sinceDays = Math.max(1, (input.now.getTime() - input.endsAt.getTime()) / DAY);
  return {
    times: Math.round((during / before) * 10) / 10,
    during: Math.round(during),
    before: Math.round(before),
    now: Math.round(input.sinceViews / sinceDays),
    endedDaysAgo: Math.max(0, Math.floor((input.now.getTime() - input.endsAt.getTime()) / DAY)),
  };
}

export type MilestoneRow = { key: string; target: number; kind: "views" | "clicks"; done: boolean; so: number };

export function milestonesFor(totals: { views: number; clicks: number }): MilestoneRow[] {
  return MILESTONES.map((row) => {
    const so = totals[row.kind];
    return { key: row.key, target: row.target, kind: row.kind, done: so >= row.target, so };
  });
}
