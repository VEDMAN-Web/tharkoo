"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/components/ui/AdCard";
import { api, friendlyError, hasSessionHint, idempotencyKey } from "@/lib/ui/api";
import { bestValueId, firstPacks, popularId, preselectedId, rupees, type PackLike } from "@/lib/credit-pack-view";
import { enoughFor, enoughParts, type PriceListData } from "@/lib/price-list";
import { PriceCard } from "./PriceCard";
import { BitcoinMark, EthereumMark, MastercardMark, UsdcMark, UsdtMark, VisaMark } from "./PayMarks";
import "./recharge.css";

/**
 * H9.1: the one way to buy credits. The Account home, the credits page, the Wallet and the posting-flow sheet all show this:
 * up to four packs, one pre-selected, a Pay button that always has a pack to pay for, and one plain line on what credits are for.
 */

export type PackChoice = { pack: PackLike; method: "card" | "crypto" };
export type WalletTab = "call" | "ad";
type CustomLimits = { min: Record<WalletTab, number>; maxPerPurchase: number; maxPerDay: number; moveEarningsMin: number };
export type CreditPackData = {
  packs: PackLike[];
  /** H18.8: call packs fill call credits (video calls only). `packs` are ad packs (posting, TOP, Super Top). */
  callPacks: PackLike[];
  custom: CustomLimits | null;
  creditPriceInr: number;
  fee: number;
  available: boolean;
  testPayments: boolean;
  prices: PriceListData | null;
};
type Method = "card" | "crypto";
type Loaded = { packs: PackLike[]; all?: PackLike[]; callPacks?: PackLike[]; custom?: CustomLimits; creditPriceInr: number; fee: number; available: boolean; testPayments?: boolean; prices?: PriceListData };

/** H18.8: same sum as the server (customCredits): the base rate, or the best pack's rate once the amount reaches its price. */
export function creditsForAmount(amount: number, creditPriceInr: number, packs: PackLike[]) {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const base = Math.floor(amount / Math.max(1, creditPriceInr));
  const best = packs.filter((p) => p.price > 0 && p.total > 0 && amount >= p.price).sort((a, b) => a.price / a.total - b.price / b.total)[0];
  return Math.max(base, best ? Math.floor(amount / (best.price / best.total)) : 0);
}

/** Loads the packs once for a signed-in person. `shortfall` makes the pack that covers it start selected. */
/**
 * signedIn is null until the browser has looked at the sign-in cookie. The server cannot see it, so reading it while the page is
 * first drawn would make the server and the browser disagree (React error 418); it is read after the page is drawn (H10.3b).
 */
export function useCreditPacks(shortfall = 0): { data: CreditPackData | null; error: string; signedIn: boolean | null } {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => setSignedIn(hasSessionHint()), 0);
    return () => window.clearTimeout(id);
  }, []);
  const [data, setData] = useState<CreditPackData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    api<Loaded>(`/api/payments/packs${shortfall > 0 ? `?shortfall=${shortfall}` : ""}`).then((res) => {
      if (!live) return;
      if (!res.ok) return setError(friendlyError(res.error));
      const { packs, all, callPacks, custom, creditPriceInr, fee, available, testPayments, prices } = res.data;
      setData({ packs: all ?? packs, callPacks: callPacks ?? [], custom: custom ?? null, creditPriceInr, fee, available, testPayments: Boolean(testPayments), prices: prices ?? null });
    });
    return () => {
      live = false;
    };
  }, [signedIn, shortfall]);
  return { data, error, signedIn };
}

export function CreditPacks({ data, shortfall = 0, returnTo, onChoice, wallet: startWallet = "ad" }: { data: CreditPackData; shortfall?: number; returnTo?: string; onChoice?: (choice: PackChoice) => void; wallet?: WalletTab }) {
  const t = useT();
  const [wallet, setWallet] = useState<WalletTab>(startWallet);
  const list = wallet === "call" ? data.callPacks : data.packs;
  const [amount, setAmount] = useState("");
  const typed = Number(amount);
  const minimum = data.custom?.min[wallet] ?? 0;
  const typedCredits = amount ? creditsForAmount(typed, data.creditPriceInr, list) : 0;
  const typedOk = Boolean(amount) && Number.isInteger(typed) && typed >= minimum && (!data.custom || typed <= data.custom.maxPerPurchase);
  const [selected, setSelected] = useState(() => preselectedId(startWallet === "call" ? data.callPacks : data.packs, shortfall));
  const [method, setMethod] = useState<Method>("card");
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const popular = popularId(list);
  const best = bestValueId(list);
  const first = firstPacks(list, wallet === startWallet ? shortfall : 0);
  const shown = showAll ? [...list].sort((a, b) => a.total - b.total) : first;
  const chosen = amount ? undefined : (list.find((pack) => pack.id === selected) ?? list[0]);
  const payAmount = chosen ? chosen.price : typedOk ? typed : 0;

  const pickWallet = (next: WalletTab) => {
    setWallet(next);
    setAmount("");
    setShowAll(false);
    setSelected(preselectedId(next === "call" ? data.callPacks : data.packs, next === startWallet ? shortfall : 0));
  };

  useEffect(() => {
    if (chosen) onChoice?.({ pack: chosen, method });
  }, [chosen, method, onChoice]);

  const pay = useCallback(async () => {
    if ((!chosen && !typedOk) || busy) return;
    setBusy(true);
    setError("");
    const back = returnTo || `${window.location.pathname}${window.location.search}`;
    const what = chosen ? { packId: chosen.id } : { wallet, amountInr: typed };
    const res = await api<{ paymentId: string; checkoutPath: string }>("/api/payments/recharge", {
      method: "POST",
      body: JSON.stringify({ ...what, method, returnTo: back, idempotencyKey: idempotencyKey(chosen ? chosen.id : `${wallet}-${typed}`) }),
    });
    if (!res.ok) {
      setBusy(false);
      return setError(res.status === 409 ? t("recharge.unavailable") : friendlyError(res.error) || t("recharge.error"));
    }
    window.location.assign(res.data.checkoutPath);
  }, [chosen, typedOk, typed, wallet, busy, method, returnTo, t]);

  return (
    <div className="tkp" data-tk="credit-packs">
      <div role="tablist" aria-label={t("recharge.walletTabs")} className="tkp-wallets">
        {(["call", "ad"] as const).map((kind) => (
          <button key={kind} type="button" role="tab" aria-selected={wallet === kind} className="tkp-wallet" data-tk={`wallet-tab-${kind}`} onClick={() => pickWallet(kind)}>
            <strong>{t(kind === "call" ? "recharge.tab.call" : "recharge.tab.ad")}</strong>
            <span>{t(kind === "call" ? "recharge.tab.callUse" : "recharge.tab.adUse")}</span>
          </button>
        ))}
      </div>
      {list.length === 0 ? <p className="tkp-note" data-tk="packs-none">{t("recharge.noPacksTypeAmount")}</p> : null}
      <div role="radiogroup" aria-label={t("recharge.packs")} className="tkr-packs tkp-packs">
        {shown.map((pack) => {
          // Only while posting costs credits: with free posting there is no "enough for" to say (the h9-1 pack test keeps this line away then).
          const parts = wallet === "ad" && data.prices && data.prices.paidPostingOn ? enoughParts(enoughFor(pack.total, data.prices), data.prices) : [];
          const badge = pack.id === popular ? "popular" : pack.id === best ? "best" : null;
          return (
            <button key={pack.id} type="button" role="radio" aria-checked={pack.id === chosen?.id} className="tkr-pack is-rich" data-tk="recharge-pack" onClick={() => { setAmount(""); setSelected(pack.id); }}>
              {badge ? <span className={`tkr-badge is-${badge}`}>{t(badge === "popular" ? "recharge.badge.popular" : "recharge.badge.best")}</span> : null}
              <span className="tkp-pay tkp-rs" data-tk="pack-rupees">{rupees(pack.price)}</span>
              <span className="tkp-get" data-tk="pack-get">
                {t("recharge.get")}{" "}
                <strong>{pack.total.toLocaleString("en-IN")}</strong> {t("recharge.credits")}
                {pack.bonus > 0 ? <em className="tkp-bonus">{t("recharge.bonus", { count: pack.bonus.toLocaleString("en-IN") })}</em> : null}
              </span>
              {parts.length ? (
                <span className="tkp-enough" data-tk="pack-ads">
                  {t("recharge.enough")}{" "}
                  {parts.map((part, index) => (
                    <span key={part.text}>
                      {index > 0 ? ", or " : ""}
                      {part.strong ? <strong>{part.text}</strong> : part.text}
                    </span>
                  ))}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {data.custom ? (
        <div className="tkp-custom" data-tk="custom-amount">
          <label htmlFor={`tkp-amount-${wallet}`}>{t("recharge.custom.label")}</label>
          <div className="tkp-custom-row">
            <span aria-hidden="true">Rs</span>
            <input
              id={`tkp-amount-${wallet}`}
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder={minimum.toLocaleString("en-IN")}
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, "").slice(0, 9))}
            />
          </div>
          <p className="tkp-note" aria-live="polite">
            {!amount
              ? t("recharge.custom.hint", { min: minimum.toLocaleString("en-IN"), max: data.custom.maxPerPurchase.toLocaleString("en-IN") })
              : typed < minimum
                ? t("recharge.custom.tooSmall", { min: minimum.toLocaleString("en-IN") })
                : typed > data.custom.maxPerPurchase
                  ? t("recharge.custom.tooBig", { max: data.custom.maxPerPurchase.toLocaleString("en-IN") })
                  : t("recharge.custom.get", { count: typedCredits.toLocaleString("en-IN") })}
          </p>
        </div>
      ) : null}
      {list.length > first.length ? (
        <button type="button" className="tkr-link tkp-more" data-tk="see-all-packs" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
          {showAll ? t("recharge.fewer") : t("recharge.seeAll")}
        </button>
      ) : null}
      <div role="radiogroup" aria-label={t("recharge.method")} className="tkr-methods">
        <button type="button" role="radio" aria-checked={method === "card"} className="tkr-method" data-tk="recharge-card" onClick={() => setMethod("card")}>
          <span className="tkr-method-name">{t("recharge.card")}</span>
          <span className="tkr-marks">
            <VisaMark size={34} />
            <MastercardMark size={34} />
          </span>
        </button>
        <button type="button" role="radio" aria-checked={method === "crypto"} className="tkr-method" data-tk="recharge-crypto" onClick={() => setMethod("crypto")}>
          <span className="tkr-method-name">{t("recharge.crypto")}</span>
          <span className="tkr-marks">
            <BitcoinMark size={24} />
            <EthereumMark size={24} />
            <UsdtMark size={24} />
            <UsdcMark size={24} />
          </span>
        </button>
      </div>
      {!data.available ? <p className="tkr-error" role="alert">{t("recharge.unavailable")}</p> : null}
      {error && data.available ? <p className="tkr-error" role="alert">{error}</p> : null}
      <button type="button" className="tkr-pay" data-tk="recharge-pay" disabled={(!chosen && !typedOk) || busy || !data.available} onClick={pay}>
        {busy ? t("recharge.starting") : t("recharge.pay", { amount: Math.round(payAmount).toLocaleString("en-IN") })}
      </button>
      <p className="tkp-note" data-tk="packs-purpose">{t(wallet === "call" ? "recharge.purpose.call" : "recharge.purpose.ad")}</p>
      {data.testPayments ? <p className="tkp-note" data-tk="packs-test">{t("recharge.testNote")}</p> : null}
    </div>
  );
}

/** The packs with their own loading, signed-out and empty words, for the account pages. */
export function CreditPacksPanel({ returnTo, withPrices = false }: { returnTo?: string; withPrices?: boolean }) {
  const t = useT();
  const { data, error, signedIn } = useCreditPacks();
  if (signedIn === null) return <p className="tkp-note" role="status">{t("recharge.loading")}</p>;
  if (!signedIn) return <p className="tkp-note">{t("recharge.login")} <Link className="tkr-link" href="/u/login/">{t("recharge.loginLink")}</Link></p>;
  if (!data) return <p className="tkp-note" role="status">{error || t("recharge.loading")}</p>;
  if (data.packs.length === 0 && data.callPacks.length === 0) return <p className="tkp-note">{t("recharge.empty")}</p>;
  if (withPrices && data.prices) {
    return (
      <div className="tkc-wrap">
        <div className="tkc-duo has-card" data-tk="credit-duo">
          <PriceCard data={data.prices} />
          <CreditPacks data={data} returnTo={returnTo} />
        </div>
      </div>
    );
  }
  return <CreditPacks data={data} returnTo={returnTo} />;
}
