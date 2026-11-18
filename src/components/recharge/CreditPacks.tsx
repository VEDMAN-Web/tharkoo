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
export type CreditPackData = { packs: PackLike[]; creditPriceInr: number; fee: number; available: boolean; testPayments: boolean; prices: PriceListData | null };
type Method = "card" | "crypto";
type Loaded = { packs: PackLike[]; all?: PackLike[]; creditPriceInr: number; fee: number; available: boolean; testPayments?: boolean; prices?: PriceListData };

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
      const { packs, all, creditPriceInr, fee, available, testPayments, prices } = res.data;
      setData({ packs: all ?? packs, creditPriceInr, fee, available, testPayments: Boolean(testPayments), prices: prices ?? null });
    });
    return () => {
      live = false;
    };
  }, [signedIn, shortfall]);
  return { data, error, signedIn };
}

export function CreditPacks({ data, shortfall = 0, returnTo, onChoice }: { data: CreditPackData; shortfall?: number; returnTo?: string; onChoice?: (choice: PackChoice) => void }) {
  const t = useT();
  const [selected, setSelected] = useState(() => preselectedId(data.packs, shortfall));
  const [method, setMethod] = useState<Method>("card");
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const popular = popularId(data.packs);
  const best = bestValueId(data.packs);
  const first = firstPacks(data.packs, shortfall);
  const shown = showAll ? [...data.packs].sort((a, b) => a.total - b.total) : first;
  const chosen = data.packs.find((pack) => pack.id === selected) ?? data.packs[0];

  useEffect(() => {
    if (chosen) onChoice?.({ pack: chosen, method });
  }, [chosen, method, onChoice]);

  const pay = useCallback(async () => {
    if (!chosen || busy) return;
    setBusy(true);
    setError("");
    const back = returnTo || `${window.location.pathname}${window.location.search}`;
    const res = await api<{ paymentId: string; checkoutPath: string }>("/api/payments/recharge", {
      method: "POST",
      body: JSON.stringify({ packId: chosen.id, method, returnTo: back, idempotencyKey: idempotencyKey(chosen.id) }),
    });
    if (!res.ok) {
      setBusy(false);
      return setError(res.status === 409 ? t("recharge.unavailable") : friendlyError(res.error) || t("recharge.error"));
    }
    window.location.assign(res.data.checkoutPath);
  }, [chosen, busy, method, returnTo, t]);

  return (
    <div className="tkp" data-tk="credit-packs">
      <div role="radiogroup" aria-label={t("recharge.packs")} className="tkr-packs tkp-packs">
        {shown.map((pack) => {
          // Only while posting costs credits: with free posting there is no "enough for" to say (the h9-1 pack test keeps this line away then).
          const parts = data.prices && data.prices.paidPostingOn ? enoughParts(enoughFor(pack.total, data.prices), data.prices) : [];
          const badge = pack.id === popular ? "popular" : pack.id === best ? "best" : null;
          return (
            <button key={pack.id} type="button" role="radio" aria-checked={pack.id === chosen?.id} className="tkr-pack is-rich" data-tk="recharge-pack" onClick={() => setSelected(pack.id)}>
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
      {data.packs.length > first.length ? (
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
      <button type="button" className="tkr-pay" data-tk="recharge-pay" disabled={!chosen || busy || !data.available} onClick={pay}>
        {busy ? t("recharge.starting") : t("recharge.pay", { amount: Math.round(chosen?.price ?? 0).toLocaleString("en-IN") })}
      </button>
      <p className="tkp-note" data-tk="packs-purpose">{t("recharge.purpose")}</p>
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
  if (data.packs.length === 0) return <p className="tkp-note">{t("recharge.empty")}</p>;
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
