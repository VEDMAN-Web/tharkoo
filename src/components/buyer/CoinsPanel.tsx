"use client";

import Link from "next/link";
import type { PackRow, PanelSummary } from "@/server/notifications/summary";
import { makeT } from "@/lib/ui/text";
import { openRecharge } from "@/components/recharge/openRecharge";
import { SignedOutPanel, UserPanelShell } from "./UserPanelShell";

const t = makeT();

/** H7.17: coins and payments on the user panel: the pack grid, the coin balance and a link to the history. */

export function CoinsPanel({ summary, packs, creditPriceInr = 10 }: { summary: PanelSummary; packs: PackRow[]; creditPriceInr?: number }) {
  const balance = summary.signedIn ? summary.balance : 0;

  if (!summary.signedIn) {
    return (
      <UserPanelShell active="coins" summary={summary}>
        <SignedOutPanel next="/u/account/credits/" title="Log in to buy credits" body="Your credit balance and purchases are kept on your account." />
      </UserPanelShell>
    );
  }

  const aside = (
    <section aria-labelledby="coins-heading" className="up-coins-card">
      <h2 id="coins-heading" className="up-coins-label">{t("panel.coins.title")}</h2>
      <p className="up-coins-value" data-tk="coin-balance">{t("panel.coins.balance", { count: balance })}</p>
      <Link href="/u/account/credits/history/" className="up-coins-link">See history</Link>
    </section>
  );

  return (
    <UserPanelShell active="coins" summary={summary} aside={aside}>
      <section aria-labelledby="buy-heading" className="up-glass up-panel">
        <div className="up-panel-head">
          <h1 id="buy-heading" className="up-h2">{t("panel.coins.buy")}</h1>
          <p className="up-muted">Choose a pack</p>
        </div>
        {packs.length === 0 ? (
          <p className="up-muted">No credit packs are on sale right now.</p>
        ) : (
          <>
            <p className="up-muted">{t("recharge.rate", { price: creditPriceInr })}</p>
            <button type="button" className="up-btn" data-tk="open-recharge" onClick={() => openRecharge({})}>{t("recharge.recharge")}</button>
          </>
        )}
      </section>
    </UserPanelShell>
  );
}
