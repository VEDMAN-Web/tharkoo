import Link from "next/link";
import type { TextFn } from "@/lib/ui/text";
import type { SellerDashboard } from "@/server/listings/seller-dashboard";
import { PromoteButton } from "./PromoteButton";
import { num } from "./format";

/** H14.3: "What your TOP boost did". Only real numbers: no boost history means no number, only the invitation. */
export function DashLift({ lift, firstAd, t }: { lift: SellerDashboard["lift"]; firstAd: { id: string; title: string } | null; t: TextFn }) {
  if (!lift) {
    return (
      <section aria-labelledby="dash-lift-h" className="up-dash-lift" data-tk="dash-lift" data-state="empty">
        <p className="up-dash-lift-kicker">{t("panel.dash.liftKicker")}</p>
        <h2 id="dash-lift-h" className="up-dash-lift-title up-dash-lift-title-small">{t("panel.dash.liftEmptyTitle")}</h2>
        <p className="up-dash-lift-text">{t("panel.dash.liftEmptyText")}</p>
        {firstAd ? (
          <div className="up-dash-lift-btns">
            <PromoteButton listingId={firstAd.id} title={firstAd.title} className="up-dash-gold">{t("panel.dash.liftEmptyButton")}</PromoteButton>
          </div>
        ) : null}
      </section>
    );
  }
  const vars = { ad: lift.adTitle, during: num(lift.during), before: num(lift.before), now: num(lift.now), days: lift.endedDaysAgo };
  return (
    <section aria-labelledby="dash-lift-h" className="up-dash-lift" data-tk="dash-lift" data-state="lift">
      <p className="up-dash-lift-kicker">{t("panel.dash.liftKicker")}</p>
      <h2 id="dash-lift-h" className="up-dash-lift-title" data-tk="lift-times">{t("panel.dash.liftTitle", { times: lift.times })}</h2>
      <p className="up-dash-lift-text" data-tk="lift-text">{t(lift.endedDaysAgo === 0 ? "panel.dash.liftTextToday" : "panel.dash.liftText", vars)}</p>
      <div className="up-dash-lift-btns">
        <PromoteButton listingId={lift.adId} title={lift.adTitle} className="up-dash-gold">{t("panel.dash.liftAgain")}</PromoteButton>
        <Link href="/u/account/analytics/" className="up-dash-lift-ghost">{t("panel.dash.liftCompare")}</Link>
      </div>
    </section>
  );
}
