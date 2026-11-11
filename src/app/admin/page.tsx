import { AdminShell } from "@/components/admin/AdminShell";
import { BarList, EmptyState, KpiCard, Notice } from "@/components/admin/ui";
import { getDashboardData, type DashboardDay } from "@/server/admin/dashboard";

export const dynamic = "force-dynamic";

const CHART_W = 720;
const CHART_H = 160;
const CHART_PAD = 8;

function shortDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

function NewAdsLine({ days }: { days: DashboardDay[] }) {
  const peak = Math.max(...days.map((day) => day.count), 1);
  const step = (CHART_W - CHART_PAD * 2) / Math.max(days.length - 1, 1);
  const y = (count: number) => CHART_H - CHART_PAD - (count / peak) * (CHART_H - CHART_PAD * 2);
  const points = days.map((day, index) => `${(CHART_PAD + index * step).toFixed(1)},${y(day.count).toFixed(1)}`).join(" ");
  const total = days.reduce((sum, day) => sum + day.count, 0);
  return (
    <figure style={{ margin: 0 }}>
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        width="100%"
        role="img"
        aria-label={`New ads per day, last ${days.length} days: ${total} in total, busiest day ${peak}`}
        style={{ display: "block", maxWidth: "100%", height: "auto" }}
      >
        <line x1={CHART_PAD} y1={CHART_H - CHART_PAD} x2={CHART_W - CHART_PAD} y2={CHART_H - CHART_PAD} stroke="var(--adm-border)" strokeWidth="1" />
        <polyline points={points} fill="none" stroke="var(--adm-primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="adm-field-help" style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <span>{shortDate(days[0].date)}</span>
        <span>
          {total.toLocaleString("en-IN")} new ads in {days.length} days, busiest day {peak.toLocaleString("en-IN")}
        </span>
        <span>{shortDate(days[days.length - 1].date)}</span>
      </figcaption>
    </figure>
  );
}

export default async function AdminHome() {
  const data = await getDashboardData();
  const { kpis } = data;
  const seriesTotal = data.newAdsPerDay.reduce((sum, day) => sum + day.count, 0);
  return (
    <AdminShell title="Dashboard">
      <div className="adm-stack">
        {data.demoListings > 0 ? (
          <Notice kind="warn" title="Demo data, not real users">
            {data.demoListings.toLocaleString("en-IN")} demo ads are mixed into the numbers below. They were added for testing and do not come from real people.
          </Notice>
        ) : null}

        <div className="adm-grid">
          <KpiCard label="Live ads" value={kpis.liveAds} hint="Ads people can see now" />
          <KpiCard label="Waiting for moderation" value={kpis.pendingModeration} hint="Ads in the review queue" />
          <KpiCard label="New ads today" value={kpis.newAdsToday} hint="Calendar day in India time" />
          <KpiCard label="New ads, last 7 days" value={kpis.newAds7d} hint="Includes today; drafts not counted" />
          <KpiCard label="New users, last 7 days" value={kpis.newUsers7d} hint="Accounts created, includes today" />
          <KpiCard label="ID checks waiting" value={kpis.idChecksWaiting} hint="Waiting for a reviewer" />
          <KpiCard label="Open reports" value={kpis.openReports} hint="Reports nobody has picked up yet" />
          <KpiCard
            label="Contact reveals, last 7 days"
            value={kpis.contactReveals7d}
            hint={kpis.contactReveals7d === null ? "No contact reveal has been logged yet" : "Times a visitor opened an ad contact"}
          />
          <KpiCard label="Promotions active" value={kpis.promotionsActive} hint="Paid placements running now" />
        </div>

        <section className="adm-card" aria-labelledby="dash-new-ads">
          <h2 id="dash-new-ads" className="t-h3">
            New ads per day
          </h2>
          {seriesTotal > 0 ? (
            <NewAdsLine days={data.newAdsPerDay} />
          ) : (
            <EmptyState title="No data yet" why="No ads were created in the last 30 days, so there is no line to draw." />
          )}
        </section>

        <div className="adm-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          <section className="adm-card" aria-labelledby="dash-by-category">
            <h2 id="dash-by-category" className="t-h3">
              Live ads by category
            </h2>
            <BarList items={data.adsByCategory} emptyText="No data yet: there are no live ads." />
          </section>
          <section className="adm-card" aria-labelledby="dash-by-city">
            <h2 id="dash-by-city" className="t-h3">
              Live ads by city (top 10)
            </h2>
            <BarList items={data.adsByCity} emptyText="No data yet: no live ad has a city." />
          </section>
        </div>
      </div>
    </AdminShell>
  );
}
