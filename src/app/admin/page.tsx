import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { EmptyState, KpiCard, Notice } from "@/components/admin/ui";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { can } from "@/lib/admin/perms";
import { getAdminCounts } from "@/server/admin/counts";
import { getDashboardData } from "@/server/admin/dashboard";
import { getLaunchChecklist } from "@/server/admin/launch-checklist";
import { loginCodeWarning } from "@/server/auth/email-code";
import { ChecklistCard } from "./_dashboard/ChecklistCard";
import { DashboardHeader } from "./_dashboard/DashboardHeader";
import { NewAdsLine } from "./_dashboard/NewAdsLine";
import { RecentCard } from "./_dashboard/RecentCard";
import { TodoCard } from "./_dashboard/TodoCard";
import "./_dashboard/dashboard.css";

export const dynamic = "force-dynamic";

const rupees = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;

function todayLine(now: Date) {
  const text = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
  return `${text.replace(",", "")}. Everything that needs a person today is in To do.`;
}

export default async function AdminHome() {
  const now = new Date();
  const staff = await getStaffFromHeaders();
  const roles = staff.roles;
  const [data, counts, checklist] = await Promise.all([
    getDashboardData(now),
    getAdminCounts(roles),
    can(roles, "settings.edit") ? getLaunchChecklist() : Promise.resolve(null),
  ]);
  const loginWarning = loginCodeWarning();
  const hidden = process.env.SITE_NOINDEX === "true";
  const showAds = can(roles, "ads.view") || can(roles, "pages.edit");
  const showMoney = can(roles, "orders.view");
  const seriesTotal = data.newAdsPerDay.reduce((sum, day) => sum + day.count, 0);
  return (
    <AdminShell title="Dashboard" hasHeader>
      <div className="adm-d" data-tk="dashboard">
        <DashboardHeader purpose={todayLine(now)} canReview={can(roles, "ads.review")} />
        <div className="adm-d-alerts">
          {data.demoActive > 0 ? (
            <Notice kind="info" title="Demo ads are on.">
              {data.demoActive.toLocaleString("en-IN")} demo ads are live and kept out of these numbers.{hidden ? " The site is hidden from Google." : ""}{" "}
              {can(roles, "ads.demo.end") ? <Link href="/admin/ads/">Open demo ads</Link> : null}
            </Notice>
          ) : null}
          {loginWarning ? (
            <Notice kind="warn" title={loginWarning}>
              No email or SMS provider can send a login code, so users and sellers cannot log in or sign up until BREVO_API_KEY is set.
            </Notice>
          ) : null}
        </div>
        <div className="adm-d-grid">
          <div className="adm-d-col">
            <TodoCard counts={counts} />
            {checklist ? <ChecklistCard rows={checklist} /> : null}
          </div>
          <div className="adm-d-col">
            {showAds || showMoney ? (
              <div className="adm-d-kpis">
                {showAds ? <KpiCard label="Live ads" value={data.liveAds.toLocaleString("en-IN")} hint="Real ads only" /> : null}
                {showAds ? <KpiCard label="New ads today" value={data.newAdsToday.toLocaleString("en-IN")} hint="Calendar day in India time" /> : null}
                {showAds ? <KpiCard label="New users today" value={data.newUsersToday.toLocaleString("en-IN")} hint="Accounts created today" /> : null}
                {showMoney ? (
                  <KpiCard
                    label="Credits sold today"
                    value={rupees(data.sales.rupees)}
                    hint={`${data.sales.orders} order${data.sales.orders === 1 ? "" : "s"} · ${data.sales.testOrders} test order${data.sales.testOrders === 1 ? "" : "s"} left out`}
                  />
                ) : null}
              </div>
            ) : null}
            {showAds ? (
              <section className="adm-card adm-d-card" aria-labelledby="dash-new-ads">
                <header className="adm-d-head">
                  <h2 id="dash-new-ads">New ads per day</h2>
                  <span className="adm-d-pill">Real ads only</span>
                </header>
                {seriesTotal > 0 ? <NewAdsLine days={data.newAdsPerDay} /> : <EmptyState title="No data yet" why="No real ads were created in the last 30 days, so there is no line to draw." />}
              </section>
            ) : null}
            <RecentCard items={data.recent} now={now.getTime()} />
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
