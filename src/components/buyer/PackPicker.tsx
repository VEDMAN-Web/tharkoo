"use client";

import { useState } from "react";
import { api, friendlyError, idempotencyKey } from "@/lib/ui/api";
import { ComingSoon, useLaunchSwitches } from "@/components/LaunchSwitches";
import type { PackRow } from "@/server/notifications/summary";

/** H7.17: the coin pack choice and the Pay button, shared by the home and the coins page. */

function inr(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

function tagText(tag: string) {
  return tag.replace(/extra (coins|credits)/i, "Extra credits");
}

export function PackPicker({ packs, onPaid }: { packs: PackRow[]; onPaid?: (balance: number) => void }) {
  const { creditPurchasesOn } = useLaunchSwitches();
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
      if (res.error.code === "PAYMENT_REQUIRED") return setMessage("Payment is required before credits can be added.");
      if (res.error.code === "CONFLICT") return setMessage("That payment was already used.");
      return setMessage(friendlyError(res.error));
    }
    onPaid?.(res.data.balance);
    const test = res.data.provider === "mock" || String(res.data.providerRef || "").startsWith("pay_test");
    setMessage(test ? "Test mode: no real payment" : "Payment started.");
  }

  return (
    <>
      <div role="radiogroup" aria-label="Credit packs" className="up-packs">
        {packs.map((pack) => {
          const on = pack.id === selected;
          return (
            <button key={pack.id} type="button" role="radio" aria-checked={on} className={on ? "up-pack up-pack-on" : "up-pack"} data-tk="pack" onClick={() => setSelected(pack.id)}>
              {pack.tag ? <span className="up-pack-tag">{tagText(pack.tag)}</span> : null}
              <span className="up-pack-coins">{pack.credits + (pack.bonus || 0)}</span>
              <span className="up-pack-unit">credits{pack.bonus ? ` (${pack.credits} + ${pack.bonus} free)` : ""}</span>
              <span className="up-pack-price">{inr(pack.price)}</span>
            </button>
          );
        })}
      </div>
      <div className="up-pay-row">
        <p aria-live="polite" className="up-muted">{message}</p>
        {creditPurchasesOn ? (
          <button type="button" className="up-btn" disabled={!chosen} onClick={pay}>
            {chosen ? `Pay ${inr(chosen.price)}` : "Choose a pack"}
          </button>
        ) : (
          <ComingSoon />
        )}
      </div>
    </>
  );
}
