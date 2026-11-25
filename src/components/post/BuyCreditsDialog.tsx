"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, X } from "lucide-react";
import { useT } from "@/components/help/UiTextProvider";
import { creditsForAmount, type CreditPackData } from "@/components/recharge/CreditPacks";
import { useFocusTrap } from "@/components/ui/useFocusTrap";
import { api, friendlyError, idempotencyKey } from "@/lib/ui/api";
import { coverPack, firstPacks, rupees, type PackLike } from "@/lib/credit-pack-view";
import "./buy-credits-dialog.css";

/** How often the payment is asked about, and when to stop asking (the payment page lives 30 minutes). */
export const POLL_MS = 3000;
export const POLL_LIMIT_MS = 30 * 60_000;

/** The clock, kept out of the component so the component stays pure. */
const nowMs = () => Date.now();

export type BuyPhase = "pick" | "waiting" | "paid" | "failed";

/** What a payment's own status means for the dialog. Anything not final keeps waiting. */
export function phaseFor(status: string | undefined): BuyPhase {
  if (status === "paid") return "paid";
  if (status === "failed" || status === "expired" || status === "cancelled") return "failed";
  return "waiting";
}

export type AmountCheck = "empty" | "small" | "big" | "bigDay" | "ok";

/** The custom amount in rupees against the limits the server sends (smallest, most per payment, most per day). */
export function checkCustomAmount(raw: string, limits: { min: number; max: number; maxPerDay: number }): AmountCheck {
  if (!raw) return "empty";
  const amount = Number(raw);
  if (!Number.isInteger(amount) || amount < limits.min) return "small";
  if (amount > limits.max) return "big";
  if (amount > limits.maxPerDay) return "bigDay";
  return "ok";
}

/** The pack that starts chosen: the smallest that covers the need, else the biggest. */
export function startingPack(packs: readonly PackLike[], need: number): PackLike | null {
  return coverPack(packs, Math.max(0, need));
}

export type BuyCreditsDialogProps = {
  /** Credits still missing for the chosen option. */
  need: number;
  /** What the chosen option costs, in credits. */
  price: number;
  /** The name of the chosen option, e.g. "TOP". */
  plan: string;
  /** The ad-credit balance now. */
  balance: number;
  /** The person pressed "Publish with ...": the new balance after the top-up. */
  onPaid: (newBalance: number) => void;
  onClose: () => void;
};

type Loaded = Omit<CreditPackData, "packs" | "callPacks" | "custom" | "testPayments" | "prices"> & { packs: PackLike[]; all?: PackLike[]; callPacks?: PackLike[]; custom?: CreditPackData["custom"]; testPayments?: boolean; prices?: CreditPackData["prices"] };
type PaymentAnswer = { id: string; status: string; credits: number };

/**
 * H21.6: the Buy-credits popup, as one component. Ad packs, the smallest that covers the need already chosen, an own amount,
 * Pay in a new tab, then the popup waits and checks the payment every 3 seconds (and when the window gets focus again).
 */
export function BuyCreditsDialog({ need, price, plan, balance, onPaid, onClose }: BuyCreditsDialogProps) {
  const t = useT();
  const ref = useFocusTrap<HTMLDivElement>(true, onClose);
  const [data, setData] = useState<CreditPackData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [picked, setPicked] = useState("");
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<BuyPhase>("pick");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checkoutPath, setCheckoutPath] = useState("");
  const [added, setAdded] = useState(0);
  const [newBalance, setNewBalance] = useState(balance);
  const paymentId = useRef("");
  const startedAt = useRef(0);
  const settling = useRef(false);

  useEffect(() => {
    let live = true;
    void api<Loaded>(`/api/payments/packs${need > 0 ? `?shortfall=${need}` : ""}`).then((res) => {
      if (!live) return;
      if (!res.ok) return setLoadError(friendlyError(res.error));
      const { packs, all, custom, creditPriceInr, fee, available, testPayments, prices, callPacks } = res.data;
      const list = all ?? packs;
      setData({ packs: list, callPacks: callPacks ?? [], custom: custom ?? null, creditPriceInr, fee, available, testPayments: Boolean(testPayments), prices: prices ?? null });
      setPicked(startingPack(list, need)?.id ?? "");
    });
    return () => {
      live = false;
    };
  }, [need]);

  // The first focus goes to the pre-selected pack (not the close button), once the packs have loaded.
  const loaded = Boolean(data);
  useEffect(() => {
    if (!loaded) return;
    ref.current?.querySelector<HTMLElement>("[data-tk=buy-pack][aria-checked=true]")?.focus();
  }, [loaded, ref]);

  const packs = data ? firstPacks(data.packs, need) : [];
  const chosen = amount ? undefined : data?.packs.find((pack) => pack.id === picked);
  const limits = data?.custom ? { min: data.custom.min.ad, max: data.custom.maxPerPurchase.ad, maxPerDay: data.custom.maxPerDay } : null;
  const check = limits ? checkCustomAmount(amount, limits) : "empty";
  const typed = Number(amount);
  const payAmount = chosen ? chosen.price : check === "ok" ? typed : 0;

  const settle = useCallback(async () => {
    if (!paymentId.current || settling.current) return;
    if (nowMs() - startedAt.current > POLL_LIMIT_MS) return setPhase("failed");
    settling.current = true;
    const res = await api<PaymentAnswer>(`/api/payments/${paymentId.current}`);
    settling.current = false;
    if (!res.ok) return;
    const next = phaseFor(res.data.status);
    if (next === "waiting") return;
    if (next === "paid") {
      const wallet = await api<{ balance: number }>("/api/wallet/");
      setAdded(res.data.credits);
      setNewBalance(wallet.ok ? Number(wallet.data.balance) || 0 : balance + res.data.credits);
      // Lets the header pill and every balance line read the new balance (a count of 0 does not start a publish).
      window.dispatchEvent(new CustomEvent("tk:credits-added", { detail: { added: 0 } }));
    }
    setPhase(next);
  }, [balance]);

  useEffect(() => {
    if (phase !== "waiting") return;
    const timer = window.setInterval(() => void settle(), POLL_MS);
    const onFocus = () => void settle();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [phase, settle]);

  async function pay() {
    if (busy || (!chosen && check !== "ok")) return;
    setBusy(true);
    setError("");
    // The new tab is opened inside the click, so the browser lets it through; it is pointed at the payment page below.
    const tab = window.open("", "_blank");
    const back = `${window.location.pathname}${window.location.search}`;
    const what = chosen ? { packId: chosen.id } : { wallet: "ad", amountInr: typed };
    const res = await api<{ paymentId: string; checkoutPath: string }>("/api/payments/recharge", {
      method: "POST",
      body: JSON.stringify({ ...what, method: "card", returnTo: back, idempotencyKey: idempotencyKey(chosen ? chosen.id : `ad-${typed}`) }),
    });
    setBusy(false);
    if (!res.ok) {
      tab?.close();
      return setError(res.status === 409 ? t("post.v2.buy.unavailable") : friendlyError(res.error) || t("post.v2.buy.error"));
    }
    paymentId.current = res.data.paymentId;
    startedAt.current = nowMs();
    setCheckoutPath(res.data.checkoutPath);
    if (tab) tab.location.href = res.data.checkoutPath;
    setPhase("waiting");
  }

  const credits = (count: number) => count.toLocaleString("en-IN");
  const title = phase === "waiting" ? t("post.v2.buy.waitTitle") : phase === "paid" ? t("post.v2.buy.paidTitle", { count: credits(added) }) : phase === "failed" ? t("post.v2.buy.failedTitle") : t("post.v2.buy.title");
  // In the page body, so a transformed parent (the post shell) cannot turn "fixed" into "inside this column".
  return createPortal(
    <div className="tkb-wrap" data-tk="buy-credits" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="tkb-dialog" role="dialog" aria-modal="true" aria-labelledby="tkb-title" tabIndex={-1} ref={ref} data-phase={phase}>
        <span className="tkb-grab" aria-hidden />
        <div className="tkb-head">
          <h2 id="tkb-title">{title}</h2>
          <button type="button" className="tkb-x" aria-label={t("post.v2.buy.close")} onClick={onClose}>
            <X size={20} aria-hidden />
          </button>
        </div>

        {phase === "pick" ? (
          <>
            <p className="tkb-line" data-tk="buy-line">
              {need > 0 ? t("post.v2.buy.line", { balance: credits(balance), plan, price: credits(price), need: credits(need) }) : t("post.v2.buy.lineEnough", { balance: credits(balance) })}
            </p>
            {!data ? <p className="tkb-note" role="status">{loadError || t("post.v2.buy.loading")}</p> : null}
            {data ? (
              <div role="radiogroup" aria-label={t("post.v2.buy.packs")} className="tkb-packs">
                {packs.map((pack) => (
                  <button key={pack.id} type="button" role="radio" aria-checked={pack.id === chosen?.id} className="tkb-pack" data-tk="buy-pack" data-id={pack.id} onClick={() => { setAmount(""); setPicked(pack.id); }}>
                    <span className="tkb-pack-main">
                      <strong>{t("post.v2.buy.packCredits", { count: credits(pack.total) })}</strong>
                      {pack.bonus > 0 ? <em>{t("post.v2.buy.packBonus", { count: credits(pack.bonus) })}</em> : null}
                      {need > 0 && pack.total >= need && pack.id === startingPack(data.packs, need)?.id ? <span className="tkb-tag" data-tk="buy-enough">{t("post.v2.buy.enough")}</span> : null}
                    </span>
                    <span className="tkb-pack-price">{rupees(pack.price)}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {data?.custom ? (
              <div className="tkb-custom" data-tk="buy-custom">
                <label htmlFor="tkb-amount">{t("post.v2.buy.customLabel")}</label>
                <div className="tkb-custom-row">
                  <span aria-hidden>₹</span>
                  <input id="tkb-amount" inputMode="numeric" pattern="[0-9]*" placeholder={credits(limits?.min ?? 0)} value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, "").slice(0, 9))} />
                </div>
                <p className="tkb-note" aria-live="polite" data-tk="buy-custom-note" data-state={check}>
                  {check === "empty" ? t("post.v2.buy.customHint", { min: credits(limits?.min ?? 0), max: credits(limits?.max ?? 0) })
                    : check === "small" ? t("post.v2.buy.customSmall", { min: credits(limits?.min ?? 0) })
                    : check === "big" ? t("post.v2.buy.customBig", { max: credits(limits?.max ?? 0) })
                    : check === "bigDay" ? t("post.v2.buy.customBigDay", { max: credits(limits?.maxPerDay ?? 0) })
                    : t("post.v2.buy.customGet", { count: credits(creditsForAmount(typed, data.creditPriceInr, data.packs)) })}
                </p>
              </div>
            ) : null}
            <p className="tkb-note" data-tk="buy-saved">{t("post.v2.buy.saved")}</p>
            {data && !data.available ? <p className="tkb-error" role="alert">{t("post.v2.buy.unavailable")}</p> : null}
            {error ? <p className="tkb-error" role="alert">{error}</p> : null}
            <button type="button" className="tkb-btn tkb-btn-p" data-tk="buy-pay" disabled={busy || !data || !data.available || (!chosen && check !== "ok")} onClick={() => void pay()}>
              {busy ? t("post.v2.buy.starting") : t("post.v2.buy.pay", { amount: credits(Math.round(payAmount)) })}
            </button>
          </>
        ) : null}

        {phase === "waiting" ? (
          <div className="tkb-state" data-tk="buy-waiting" role="status">
            <Loader2 className="tkb-spin" size={36} aria-hidden />
            <p className="tkb-state-text">{t("post.v2.buy.waitText")}</p>
            {checkoutPath ? <a href={checkoutPath} target="_blank" rel="noopener noreferrer" className="tkb-link" data-tk="buy-open-again">{t("post.v2.buy.openAgain")}</a> : null}
          </div>
        ) : null}

        {phase === "paid" ? (
          <div className="tkb-state" data-tk="buy-paid" role="status">
            <span className="tkb-ok" aria-hidden><Check size={30} /></span>
            <p className="tkb-state-text" data-tk="buy-new-balance">{t("post.v2.buy.paidBalance", { balance: credits(newBalance) })}</p>
            <button type="button" className="tkb-btn tkb-btn-p" data-tk="buy-publish" onClick={() => onPaid(newBalance)}>{t("post.v2.buy.publish", { plan, price: credits(price) })}</button>
            <button type="button" className="tkb-btn" data-tk="buy-back" onClick={onClose}>{t("post.v2.buy.back")}</button>
          </div>
        ) : null}

        {phase === "failed" ? (
          <div className="tkb-state" data-tk="buy-failed" role="alert">
            <p className="tkb-state-text">{t("post.v2.buy.failedText")}</p>
            <button type="button" className="tkb-btn tkb-btn-p" data-tk="buy-try-again" onClick={() => { paymentId.current = ""; setError(""); setPhase("pick"); }}>{t("post.v2.buy.tryAgain")}</button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
