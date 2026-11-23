"use client";

import { useState } from "react";
import { useT } from "@/components/ui/AdCard";
import { api, friendlyError, idempotencyKey } from "@/lib/ui/api";
import { firstPacks, preselectedId, rupees } from "@/lib/credit-pack-view";
import { creditsForAmount, useCreditPacks, type CreditPackData } from "./CreditPacks";
import "./call-popup.css";

type Method = "card" | "crypto";

/**
 * H19.3: buying call credits inside the video call pop-up. Call packs only (four of them) and an own-amount box: no ad credits,
 * no tabs. After the payment the checkout returns to `returnTo`, the same ad page, with the pop-up open again.
 */
export function CallPacksView({ data, shortfall = 0, returnTo }: { data: CreditPackData; shortfall?: number; returnTo: string }) {
  const t = useT();
  const list = data.callPacks;
  const shown = firstPacks(list, shortfall);
  const [selected, setSelected] = useState(() => preselectedId(list, shortfall));
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>("card");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const typed = Number(amount);
  const minimum = data.custom?.min.call ?? 0;
  const maximum = data.custom?.maxPerPurchase.call ?? 0;
  const typedOk = Boolean(amount) && Number.isInteger(typed) && typed >= minimum && (!data.custom || typed <= maximum);
  const chosen = amount ? undefined : (list.find((pack) => pack.id === selected) ?? shown[0]);
  const payAmount = chosen ? chosen.price : typedOk ? typed : 0;

  async function pay() {
    if ((!chosen && !typedOk) || busy) return;
    setBusy(true);
    setError("");
    const what = chosen ? { packId: chosen.id } : { wallet: "call", amountInr: typed };
    const res = await api<{ paymentId: string; checkoutPath: string }>("/api/payments/recharge", {
      method: "POST",
      body: JSON.stringify({ ...what, method, returnTo, idempotencyKey: idempotencyKey(chosen ? chosen.id : `call-${typed}`) }),
    });
    if (!res.ok) {
      setBusy(false);
      return setError(res.status === 409 ? t("recharge.unavailable") : friendlyError(res.error) || t("recharge.error"));
    }
    window.location.assign(res.data.checkoutPath);
  }

  return (
    <div className="tkcb" data-tk="call-packs">
      <div role="radiogroup" aria-label={t("ad.buy.packs")} className="tkcb-packs">
        {shown.map((pack) => (
          <button key={pack.id} type="button" role="radio" aria-checked={pack.id === chosen?.id} className="tkcb-pack" data-tk="call-pack" onClick={() => { setAmount(""); setSelected(pack.id); }}>
            <strong>{pack.total.toLocaleString("en-IN")}</strong>
            <span>{t("ad.buy.coins")}</span>
            <span className="tkcb-price">{rupees(pack.price)}</span>
            {pack.bonus > 0 ? <em>{t("recharge.bonus", { count: pack.bonus.toLocaleString("en-IN") })}</em> : null}
          </button>
        ))}
      </div>
      {data.custom ? (
        <div className="tkcb-custom" data-tk="call-custom">
          <label htmlFor="tkcb-amount">{t("ad.buy.own")}</label>
          <div className="tkcb-row">
            <span aria-hidden="true">Rs</span>
            <input id="tkcb-amount" inputMode="numeric" pattern="[0-9]*" placeholder={minimum.toLocaleString("en-IN")} value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, "").slice(0, 9))} />
          </div>
          {amount ? (
            <p aria-live="polite">
              {typed < minimum
                ? t("recharge.custom.tooSmall", { min: minimum.toLocaleString("en-IN") })
                : typed > maximum
                  ? t("recharge.custom.tooBig", { max: maximum.toLocaleString("en-IN") })
                  : t("ad.buy.ownGet", { count: creditsForAmount(typed, data.creditPriceInr, list).toLocaleString("en-IN") })}
            </p>
          ) : null}
        </div>
      ) : null}
      <div role="radiogroup" aria-label={t("recharge.method")} className="tkcb-methods">
        {(["card", "crypto"] as const).map((kind) => (
          <button key={kind} type="button" role="radio" aria-checked={method === kind} className="tkcb-method" data-tk={`call-${kind}`} onClick={() => setMethod(kind)}>
            {t(kind === "card" ? "recharge.card" : "recharge.crypto")}
          </button>
        ))}
      </div>
      {!data.available ? <p className="tkcb-error" role="alert">{t("recharge.unavailable")}</p> : null}
      {error && data.available ? <p className="tkcb-error" role="alert">{error}</p> : null}
      <button type="button" className="tkn-pop-btn" data-tk="call-pay" disabled={(!chosen && !typedOk) || busy || !data.available} onClick={() => void pay()}>
        {busy ? t("recharge.starting") : t("recharge.pay", { amount: Math.round(payAmount).toLocaleString("en-IN") })}
      </button>
    </div>
  );
}

/** The call packs with their own loading words, for the pop-up. */
export function CallPacks({ shortfall = 0, returnTo }: { shortfall?: number; returnTo: string }) {
  const t = useT();
  const { data, error, signedIn } = useCreditPacks(shortfall);
  if (signedIn === null || (signedIn && !data && !error)) return <p className="tkcb-note" role="status">{t("recharge.loading")}</p>;
  if (!signedIn) return <p className="tkcb-note">{t("recharge.login")}</p>;
  if (!data) return <p className="tkcb-note" role="status">{error}</p>;
  return <CallPacksView data={data} shortfall={shortfall} returnTo={returnTo} />;
}
