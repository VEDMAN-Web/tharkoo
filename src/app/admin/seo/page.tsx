import { AdminShell } from "@/components/admin/AdminShell";
import { BarList, EmptyState, KpiCard } from "@/components/admin/ui";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { loadOverview } from "@/app/admin/seo/overview";
import { RunSeoCheck } from "./RunSeoCheck";
import { SeoTabs } from "./SeoTabs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SEO_ROLES = ["seo_editor", "admin", "superadmin"];

function when(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "never";
}

export default async function SeoOverviewPage() {
  const [identity, overview] = await Promise.all([getStaffFromHeaders(), loadOverview()]);
  const canRun = identity.roles.some((role) => SEO_ROLES.includes(role));
  const kpis = overview.kpis;
  const trend = overview.trend.slice(-10).map((point) => ({
    label: new Date(point.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    value: point.p0Rows + point.p1Rows,
  }));
  return (
    <AdminShell title="SEO overview">
      <SeoTabs current="/admin/seo/" />
      <div className="adm-stack">
        <section className="adm-card" style={{ display: "grid", gap: 12 }}>
          <p style={{ margin: 0 }}>
            Last check: <strong>{when(overview.lastRunAt)}</strong>
            {overview.triggeredBy ? ` (started by ${overview.triggeredBy})` : ""}. The site is also checked automatically every night.
          </p>
          <RunSeoCheck canRun={canRun} waiting={overview.waiting} />
        </section>
        {kpis ? (
          <div className="adm-grid">
            <KpiCard label="Pages in sitemap" value={kpis.urls.toLocaleString("en-IN")} hint={kpis.checked < kpis.urls ? `Last check opened ${kpis.checked.toLocaleString("en-IN")} of them` : undefined} />
            <KpiCard label="Indexable pages" value={kpis.indexable.toLocaleString("en-IN")} hint="Pages that answered 200 and are not noindex" />
            <KpiCard label="Pages with P0 issues" value={kpis.p0Rows.toLocaleString("en-IN")} hint="Fix first" />
            <KpiCard label="Pages with P1 issues" value={kpis.p1Rows.toLocaleString("en-IN")} />
            <KpiCard label="Thin pages" value={kpis.thin.toLocaleString("en-IN")} hint="Under 150 words" />
            <KpiCard label="Duplicate titles or descriptions" value={kpis.duplicates.toLocaleString("en-IN")} />
            <KpiCard label="robots.txt problems" value={kpis.robotsIssues.toLocaleString("en-IN")} />
            <KpiCard label="Redirects" value={kpis.redirects.toLocaleString("en-IN")} />
          </div>
        ) : (
          <EmptyState title="No SEO check has run yet" why="Press Run SEO check now to crawl the site and fill this page." />
        )}
        {trend.length > 1 ? (
          <section className="adm-card" style={{ display: "grid", gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Pages with issues, last checks</h2>
            <BarList items={trend} />
          </section>
        ) : null}
      </div>
    </AdminShell>
  );
}
