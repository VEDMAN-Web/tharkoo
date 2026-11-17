import type { DashboardDay } from "@/server/admin/dashboard";

const CHART_W = 720;
const CHART_H = 160;
const CHART_PAD = 8;

function shortDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function NewAdsLine({ days }: { days: DashboardDay[] }) {
  const peak = Math.max(...days.map((day) => day.count), 1);
  const step = (CHART_W - CHART_PAD * 2) / Math.max(days.length - 1, 1);
  const y = (count: number) => CHART_H - CHART_PAD - (count / peak) * (CHART_H - CHART_PAD * 2);
  const points = days.map((day, index) => `${(CHART_PAD + index * step).toFixed(1)},${y(day.count).toFixed(1)}`).join(" ");
  const total = days.reduce((sum, day) => sum + day.count, 0);
  return (
    <figure className="adm-d-fig">
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} width="100%" role="img" aria-label={`New ads per day, last ${days.length} days: ${total} in total, busiest day ${peak}`}>
        <line x1={CHART_PAD} y1={CHART_H - CHART_PAD} x2={CHART_W - CHART_PAD} y2={CHART_H - CHART_PAD} stroke="var(--adm-border)" strokeWidth="1" />
        <polyline points={points} fill="none" stroke="var(--adm-primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="adm-d-cap">
        <span>{shortDate(days[0].date)}</span>
        <span>{total.toLocaleString("en-IN")} new ads in {days.length} days, busiest day {peak.toLocaleString("en-IN")}</span>
        <span>{shortDate(days[days.length - 1].date)}</span>
      </figcaption>
    </figure>
  );
}
