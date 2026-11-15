"use client";

import Link from "next/link";
import { useState } from "react";
import type { PackRow, PanelSummary } from "@/server/notifications/summary";
import { PackPicker } from "./PackPicker";
import { SignedOutPanel, UserPanelShell } from "./UserPanelShell";

/** H7.17: coins and payments on the user panel: the pack grid, the coin balance and a link to the history. */

export function CoinsPanel({ summary, packs }: { summary: PanelSummary; packs: PackRow[] }) {
  const [balance, setBalance] = useState(summary.signedIn ? summary.balance : 0);

  if (!summary.signedIn) {
    return (
      <UserPanelShell active="coins" summary={summary}>
        <SignedOutPanel next="/u/account/credits/" title="Log in to buy coins" body="Your coin balance and purchases are kept on your account." />
      </UserPanelShell>
    );
  }

  const aside = (
    <section aria-labelledby="coins-heading" className="up-coins-card">
      <h2 id="coins-heading" className="up-coins-label">Your coins</h2>
      <p className="up-coins-value" data-tk="coin-balance">{balance} coins</p>
      <Link href="/u/account/credits/history/" className="up-coins-link">See history</Link>
    </section>
  );

  return (
    <UserPanelShell active="coins" summary={summary} aside={aside}>
      <section aria-labelledby="buy-heading" className="up-glass up-panel">
        <div className="up-panel-head">
          <h1 id="buy-heading" className="up-h2">Buy coins</h1>
          <p className="up-muted">Choose a pack</p>
        </div>
        {packs.length === 0 ? <p className="up-muted">No coin packs are on sale right now.</p> : <PackPicker packs={packs} onPaid={setBalance} />}
      </section>
    </UserPanelShell>
  );
}
