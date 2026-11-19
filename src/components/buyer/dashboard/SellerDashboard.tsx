import Link from "next/link";
import { Coins } from "lucide-react";
import { makeT, type UiTextMap } from "@/lib/ui/text";
import type { SellerDashboard as Data } from "@/server/listings/seller-dashboard";
import { DashAds } from "./DashAds";
import { DashChart } from "./DashChart";
import { DashGoal } from "./DashGoal";
import { DashLift } from "./DashLift";
import { DashTiles } from "./DashTiles";
import { PresencePing } from "./PresencePing";
import { num } from "./format";
import "./dashboard.css";

/** H14.3: the panel home for a seller with at least one ad. Every number comes from sellerDashboard(), which only reads real counts. */
export function SellerDashboardView({ dash, name, balance, texts }: { dash: Data; name: string; balance: number; texts?: UiTextMap }) {
  const t = makeT(texts);
  const firstLive = dash.ads.find((ad) => ad.status === "live") ?? null;
  return (
    <div className="up-dash" data-tk="seller-dashboard">
      <PresencePing />
      <header className="up-dash-head">
        <div>
          <p className="up-dash-hello">{t("panel.dash.hello", { name })}</p>
          <h1 className="up-dash-h1">{t("panel.dash.title")}</h1>
          <p className="up-dash-sub">{t("panel.dash.sub")}</p>
        </div>
        <div className="up-dash-actions">
          <Link href="/u/account/credits/" className="up-dash-gold" data-tk="dash-credits">
            <Coins size={20} aria-hidden="true" />
            {t("panel.dash.credits", { count: num(balance) })}
          </Link>
          <Link href="/u/post-insert/" className="up-dash-pink" data-tk="dash-post">{t("panel.dash.post")}</Link>
        </div>
      </header>
      <DashTiles dash={dash} t={t} />
      <div className="up-dash-row2">
        <DashChart days={dash.days} t={t} />
        <DashLift lift={dash.lift} firstAd={firstLive ? { id: firstLive.id, title: firstLive.title } : null} t={t} />
      </div>
      <DashAds dash={dash} t={t} />
      <DashGoal goal={dash.goal} milestones={dash.milestones} t={t} />
    </div>
  );
}
