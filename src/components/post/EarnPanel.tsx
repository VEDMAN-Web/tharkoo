"use client";

import Link from "next/link";
import { Ban, Coins, Lock, PhoneCall, Repeat2, Wallet } from "lucide-react";
import { useT } from "@/components/help/UiTextProvider";
import type { EarnInfo } from "@/components/vendor/TourInbox";

/** The calls shown in the example line ("10 calls"). A way to read the number, not a price. */
const EXAMPLE_CALLS = 10;

/**
 * H21.5a: "Earn from video calls". Three states: on (green list), off (dashed, grey) and locked (Free). The wording of the two lines about
 * what a call earns is Vedant's; the numbers come from the settings through the earn-info answer (the share and the call price).
 */
export function EarnPanel({ state, earn }: { state: "on" | "off" | "locked"; earn: EarnInfo | null }) {
  const t = useT();
  const option = earn?.options[0];
  if (state === "locked") {
    return (
      <section className="tkr-earn is-locked" data-tk="earn-panel" data-state="locked" aria-label={t("post.v2.rev.earnTitle")}>
        <p className="tkr-earn-title">{t("post.v2.rev.earnTitle")}</p>
        <div className="tkr-earn-lock"><Lock size={20} aria-hidden="true" focusable="false" /><span><b>{t("post.v2.rev.earnLocked")}</b>{t("post.v2.rev.earnLockedBody")}</span></div>
      </section>
    );
  }
  if (state === "off") {
    return (
      <section className="tkr-earn is-off" data-tk="earn-panel" data-state="off" aria-label={t("post.v2.rev.earnTitle")}>
        <p className="tkr-earn-title">{t("post.v2.rev.earnTitle")}</p>
        <div className="tkr-earn-lock"><Ban size={20} aria-hidden="true" focusable="false" /><span><b>{t("post.v2.rev.earnOff")}</b>{t("post.v2.rev.earnOffBody")}</span></div>
      </section>
    );
  }
  const rest = option ? option.price - option.youKeep : 0;
  const restRupees = option && option.youKeep > 0 ? Math.round((option.rupees / option.youKeep) * rest) : 0;
  const percent = earn ? Math.round(earn.sharePercent) : null;
  return (
    <section className="tkr-earn is-on" data-tk="earn-panel" data-state="on" aria-label={t("post.v2.rev.earnTitle")}>
      <p className="tkr-earn-title">{t("post.v2.rev.earnTitle")}</p>
      <div className="tkr-earn-head"><span className="tkr-earn-dot"><PhoneCall size={18} aria-hidden="true" focusable="false" /></span><span><b>{t("post.v2.rev.earnOn")}</b><small>{t("post.v2.rev.earnComes")}</small></span></div>
      <ul className="tkr-earn-list">
        <li><span className="tkr-earn-ic"><PhoneCall size={16} aria-hidden="true" focusable="false" /></span><span><b>{t("post.v2.rev.earnGetTitle")}</b>{t("post.v2.rev.earnGet")}</span></li>
        <li>
          <span className="tkr-earn-ic"><Coins size={16} aria-hidden="true" focusable="false" /></span>
          {option ? (
            <span><b>{t("post.v2.rev.earnEveryTitle", { rupees: option.rupees })}</b>{t("post.v2.rev.earnEvery", { price: option.price })}{" "}<b data-tk="earn-keep">{t("post.v2.rev.earnKeep", { keep: option.youKeep, rupees: option.rupees, rest, restRupees })}</b></span>
          ) : (
            <span><b>{t("post.v2.rev.earnEveryTitleAny")}</b>{t("post.v2.rev.earnEveryAny")}{percent !== null ? <>{" "}<b data-tk="earn-keep">{t("post.v2.rev.earnKeepPercent", { keep: percent, rest: 100 - percent })}</b></> : null}</span>
          )}
        </li>
        <li><span className="tkr-earn-ic"><Repeat2 size={16} aria-hidden="true" focusable="false" /></span><span><b>{t("post.v2.rev.earnMoreTitle")}</b>{t("post.v2.rev.earnMore")}</span></li>
        <li><span className="tkr-earn-ic"><Wallet size={16} aria-hidden="true" focusable="false" /></span><span><b>{t("post.v2.rev.earnWithdrawTitle")}</b>{t("post.v2.rev.earnWithdraw")}</span></li>
      </ul>
      {option ? <div className="tkr-earn-example"><span>{t("post.v2.rev.earnExample", { count: EXAMPLE_CALLS })}</span><b>= ₹{(EXAMPLE_CALLS * option.rupees).toLocaleString("en-IN")}</b></div> : null}
      <Link href="/help/" target="_blank" rel="noopener" className="tkr-earn-link">{t("post.v2.rev.earnHow")}</Link>
    </section>
  );
}
