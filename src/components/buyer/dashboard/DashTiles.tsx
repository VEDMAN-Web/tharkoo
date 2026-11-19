import type { TextFn } from "@/lib/ui/text";
import type { SellerDashboard } from "@/server/listings/seller-dashboard";
import { num } from "./format";

type Pill = { text: string; tone: "up" | "down" | "warn" | "flat" };

function trendPill(t: TextFn, total: number, percent: number | null): Pill | null {
  if (percent === null) return total > 0 ? { text: t("panel.dash.tileNew"), tone: "flat" } : null;
  if (percent === 0) return { text: "0%", tone: "flat" };
  return { text: `${percent > 0 ? "↑" : "↓"} ${num(Math.abs(percent))}%`, tone: percent > 0 ? "up" : "down" };
}

function Spark({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(1, ...values);
  return (
    <div className="up-dash-spark" aria-hidden="true">
      {values.map((value, index) => (
        <span key={index} style={{ height: `${Math.max(10, Math.round((value / max) * 100))}%`, background: color }} />
      ))}
    </div>
  );
}

function Tile({ label, value, pill, spark, color, note, tk }: { label: string; value: number; pill: Pill | null; spark: number[]; color: string; note: string; tk: string }) {
  return (
    <div className="up-dash-kpi" data-tk={tk}>
      <div className="up-dash-kpi-top">
        <span className="up-dash-kpi-label">{label}</span>
        {pill ? <span className={`up-dash-pill up-dash-pill-${pill.tone}`}>{pill.text}</span> : null}
      </div>
      <span className="up-dash-kpi-value" data-tk={`${tk}-value`}>{num(value)}</span>
      <Spark values={spark} color={color} />
      <span className="up-dash-kpi-note">{note}</span>
    </div>
  );
}

/** H14.3: Live ads, Views, Clicks. Three across on every screen. No click rate anywhere. */
export function DashTiles({ dash, t }: { dash: SellerDashboard; t: TextFn }) {
  const { counts, views, clicks } = dash;
  return (
    <section aria-label="Key numbers" className="up-dash-kpis" data-tk="dash-tiles">
      <Tile
        tk="tile-live"
        label={t("panel.dash.tileLive")}
        value={counts.live}
        pill={counts.endsSoon > 0 ? { text: t("panel.dash.tileEndsSoon", { count: counts.endsSoon }), tone: "warn" } : null}
        spark={dash.liveSpark}
        color="#e9c46a"
        note={t("panel.dash.tileReview", { review: counts.review, drafts: counts.drafts })}
      />
      <Tile tk="tile-views" label={t("panel.dash.tileViews")} value={views.total} pill={trendPill(t, views.total, views.percent)} spark={views.spark} color="#f48fc4" note={t("panel.dash.tileBefore", { count: num(views.previous) })} />
      <Tile tk="tile-clicks" label={t("panel.dash.tileClicks")} value={clicks.total} pill={trendPill(t, clicks.total, clicks.percent)} spark={clicks.spark} color="#8b5fa8" note={t("panel.dash.tileBefore", { count: num(clicks.previous) })} />
    </section>
  );
}
