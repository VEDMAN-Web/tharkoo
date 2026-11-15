"use client";

import Link from "next/link";
import { useState } from "react";
import { api, friendlyError, idempotencyKey } from "@/lib/ui/api";
import type { PackRow, PanelSummary } from "@/server/notifications/summary";
import { SignedOutPanel, UserPanelShell } from "./UserPanelShell";

/** H7.17: coins and payments on the user panel: the pack grid, the coin balance and a link to the history. */

function inr(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

export function CoinsPanel({ summary, packs }: { summary: PanelSummary; packs: PackRow[] }) {
  const [balance, setBalance] = useState(summary.signedIn ? summary.balance : 0);
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState("");
  const chosen = packs.find((pack) => pack.id === selected);

  async function pay() {
    if (!chosen) return;
    setMessage("");
    const res = await api<{ balance: number; providerRef?: string; provider?: string }>("/api/wallet/packs", {
      method: "POST",
      body: JSON.stringify({ packId: chosen.id, idempotencyKey: idempotencyKey(chosen.id) }),
    });
    if (!res.ok) {
      if (res.error.code === "PAYMENT_REQUIRED") return setMessage("Payment is required before coins can be added.");
      if (res.error.code === "CONFLICT") return setMessage("That payment was already used.");
      return setMessage(friendlyError(res.error));
    }
    setBalance(res.data.balance);
    const test = res.data.provider === "mock" || String(res.data.providerRef || "").startsWith("pay_test");
    setMessage(test ? "Test mode: no real payment" : "Payment started.");
  }

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
        {packs.length === 0 ? (
          <p className="up-muted">No coin packs are on sale right now.</p>
        ) : (
          <div role="radiogroup" aria-label="Coin packs" className="up-packs">
            {packs.map((pack) => {
              const on = pack.id === selected;
              return (
                <button
                  key={pack.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={on ? "up-pack up-pack-on" : "up-pack"}
                  data-tk="pack"
                  onClick={() => setSelected(pack.id)}
                >
                  {pack.tag ? <span className="up-pack-tag">{pack.tag}</span> : null}
                  <span className="up-pack-coins">{pack.credits + (pack.bonus || 0)}</span>
                  <span className="up-pack-unit">coins{pack.bonus ? ` (${pack.credits} + ${pack.bonus} free)` : ""}</span>
                  <span className="up-pack-price">{inr(pack.price)}</span>
                </button>
              );
            })}
          </div>
        )}
        <div className="up-pay-row">
          <p aria-live="polite" className="up-muted">{message}</p>
          <button type="button" className="up-btn" disabled={!chosen} onClick={pay}>
            {chosen ? `Pay ${inr(chosen.price)}` : "Choose a pack"}
          </button>
        </div>
      </section>
    </UserPanelShell>
  );
}
