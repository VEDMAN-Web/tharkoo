import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { BarList, EmptyState, KpiCard } from "@/components/admin/ui";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { loadOverview } from "@/app/admin/seo/overview";
import { NIGHTLY_PAGE_LIMIT } from "@/server/seo/audit-run";
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
  const hidden = process.env.SITE_NOINDEX === "true";
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
            {overview.triggeredBy ? ` (started by ${overview.triggeredBy})` : ""}. The site is also checked automatically every night (the first {NIGHTLY_PAGE_LIMIT.toLocaleString("en-IN")} pages of the sitemap, so it finishes in time).
          </p>
          <RunSeoCheck canRun={canRun} waiting={overview.waiting} />
        </section>
        {kpis ? (
          <div className="adm-grid">
            <KpiCard label="Pages in sitemap" value={kpis.urls.toLocaleString("en-IN")} hint={kpis.checked < kpis.urls ? `Last check opened ${kpis.checked.toLocaleString("en-IN")} of them` : undefined} />
            <KpiCard label="Indexable pages" value={kpis.indexable.toLocaleString("en-IN")} hint="Pages that answered 200 and are not noindex" />
            <KpiCard label="Pages with Must fix issues" value={kpis.p0Rows.toLocaleString("en-IN")} hint="Fix these first" />
            <KpiCard label="Pages with Should fix issues" value={kpis.p1Rows.toLocaleString("en-IN")} />
            <KpiCard label="Thin pages" value={kpis.thin.toLocaleString("en-IN")} hint="Under 150 words" />
            <KpiCard label="Duplicate titles or descriptions" value={kpis.duplicates.toLocaleString("en-IN")} />
            <KpiCard label="robots.txt problems" value={kpis.robotsIssues.toLocaleString("en-IN")} />
            <KpiCard label="Redirects" value={kpis.redirects.toLocaleString("en-IN")} />
          </div>
        ) : (
          <EmptyState title="No SEO check has run yet" why="Press Run SEO check now to crawl the site and fill this page." />
        )}
        {hidden ? (
          <p className="adm-field-help" data-tk="seo-hidden-note" style={{ margin: 0 }}>
            The site is hidden from Google until launch, so no page counts as indexable yet. Most of the Must fix issues come from that. Before launch, <Link href="/admin/seo/indexing/">turn on indexing in SEO</Link>.
          </p>
        ) : null}
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
