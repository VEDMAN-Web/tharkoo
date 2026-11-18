import type { TextFn } from "@/lib/ui/text";
import type { SellerDashboard } from "@/server/listings/seller-dashboard";
import { num } from "./format";

/** H14.3: one column a day (India days): a views bar and a clicks bar. Days with a TOP boost running are shaded gold. */
export function DashChart({ days, t }: { days: SellerDashboard["days"]; t: TextFn }) {
  const max = Math.max(1, ...days.map((day) => day.views), ...days.map((day) => day.clicks));
  return (
    <section aria-labelledby="dash-chart-h" className="up-dash-card up-dash-chart" data-tk="dash-chart">
      <div className="up-dash-chart-head">
        <h2 id="dash-chart-h" className="up-dash-h2">{t("panel.dash.chartTitle")}</h2>
        <div className="up-dash-legend">
          <span><i className="up-dash-key up-dash-key-views" />{t("panel.dash.chartViews")}</span>
          <span><i className="up-dash-key up-dash-key-clicks" />{t("panel.dash.chartClicks")}</span>
          <span><i className="up-dash-key up-dash-key-top" />{t("panel.dash.chartTop")}</span>
        </div>
      </div>
      <ol className="up-dash-cols">
        {days.map((day) => (
          <li key={day.key} className="up-dash-col" data-tk="chart-day" data-top={day.topOn ? "on" : "off"} data-views={day.views} data-clicks={day.clicks} aria-label={`${day.label}: ${day.views} views, ${day.clicks} clicks`}>
            <span className="up-dash-col-value">{num(day.views)}</span>
            <div className="up-dash-bars" aria-hidden="true">
              <span className="up-dash-bar up-dash-bar-views" style={{ height: `${Math.round((day.views / max) * 100)}%` }} />
              <span className="up-dash-bar up-dash-bar-clicks" style={{ height: `${Math.round((day.clicks / max) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ol>
      <ol className="up-dash-days" aria-hidden="true">
        {days.map((day) => (
          <li key={day.key}>{day.label}</li>
        ))}
      </ol>
    </section>
  );
}
