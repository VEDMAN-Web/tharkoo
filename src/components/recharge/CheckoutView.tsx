"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Lock } from "lucide-react";
import { useT } from "@/components/ui/AdCard";
import { api, friendlyError } from "@/lib/ui/api";
import type { paymentView } from "@/server/billing/recharge";
import { CoinMark, MastercardMark, VisaMark } from "./PayMarks";
import { MockQr } from "./MockQr";
import "./checkout.css";

type Payment = ReturnType<typeof paymentView>;
type Phase = "ready" | "processing" | "waiting" | "paid" | "cancelled" | "expired" | "closed";

const PROCESSING_MS = 2000;
const WAITING_MS = 3000;
const COINS = ["BTC", "ETH", "USDT", "USDC"] as const;
const NETWORKS = ["TRC-20", "ERC-20", "BEP-20"] as const;
const money = (value: number) => value.toLocaleString("en-IN");

function backUrl(payment: Payment, result: "paid" | "failed") {
  const base = payment.returnTo || "/u/account/credits/";
  const joiner = base.includes("?") ? "&" : "?";
  return `${base}${joiner}recharge=${result}&credits=${payment.credits}&payment=${payment.id}`;
}

function initialPhase(payment: Payment): Phase {
  if (payment.status === "paid") return "paid";
  if (payment.status === "cancelled") return "cancelled";
  if (payment.status === "expired") return "expired";
  if (payment.status === "failed") return "closed";
  return "ready";
}

function clock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function CheckoutView({ payment: first }: { payment: Payment }) {
  const t = useT();
  const [payment, setPayment] = useState(first);
  const [phase, setPhase] = useState<Phase>(initialPhase(first));
  const [error, setError] = useState("");
  const [coin, setCoin] = useState<string>(first.coin ?? "");
  const [network, setNetwork] = useState<string>(first.network ?? "");
  const [left, setLeft] = useState(() => (first.expiresAt ? new Date(first.expiresAt).getTime() - Date.now() : 0));
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  const crypto = payment.method === "crypto";
  const picked = crypto && Boolean(payment.coin && payment.depositAddress);

  useEffect(() => {
    if (!crypto || !picked || !payment.expiresAt || phase !== "ready") return;
    const end = new Date(payment.expiresAt).getTime();
    const tick = () => {
      const remaining = end - Date.now();
      setLeft(remaining);
      if (remaining <= 0) setPhase("expired");
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [crypto, picked, payment.expiresAt, phase]);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const finish = useCallback(
    (result: "paid" | "failed", delay: number, done: Payment) => {
      timer.current = window.setTimeout(() => window.location.assign(backUrl(done, result)), delay);
    },
    [],
  );

  async function confirm(outcome: "paid" | "cancelled") {
    setError("");
    setPhase(outcome === "paid" ? (crypto ? "waiting" : "processing") : "cancelled");
    const started = Date.now();
    const res = await api<{ payment: Payment }>(`/api/payments/${payment.id}/confirm`, { method: "POST", body: JSON.stringify({ outcome }) });
    if (!res.ok) {
      setPhase("ready");
      return setError(friendlyError(res.error));
    }
    if (outcome === "cancelled") return finish("failed", 600, res.data.payment);
    const wait = Math.max(0, (crypto ? WAITING_MS : PROCESSING_MS) - (Date.now() - started));
    timer.current = window.setTimeout(() => {
      setPayment(res.data.payment);
      setPhase("paid");
      finish("paid", 1200, res.data.payment);
    }, wait);
  }

  async function choose() {
    if (!coin) return;
    setError("");
    const res = await api<Payment>(`/api/payments/${payment.id}/coin`, { method: "POST", body: JSON.stringify({ coin, network: network || undefined }) });
    if (!res.ok) return setError(friendlyError(res.error));
    setPayment(res.data);
    setLeft(res.data.expiresAt ? new Date(res.data.expiresAt).getTime() - Date.now() : 0);
  }

  async function copy() {
    if (!payment.depositAddress) return;
    try {
      await navigator.clipboard.writeText(payment.depositAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const stable = coin === "USDT" || coin === "USDC";
  const busy = phase === "processing" || phase === "waiting";

  return (
    <main className="tkc-page" data-tk="checkout" data-phase={phase} data-method={payment.method}>
      <div className="tkc-card">
        <span className="tkc-ribbon" data-tk="test-ribbon">{t("checkout.ribbon")}</span>
        <div className="tkc-top">
          <p className="tkc-merchant">{t("checkout.merchant")}</p>
          <p className="tkc-lock">
            <Lock size={14} aria-hidden /> {t("recharge.secure")}
          </p>
        </div>
        <h1 className="tkc-title">{crypto ? t("checkout.crypto.title") : t("recharge.card")}</h1>
        <dl className="tkc-sum">
          <div>
            <dt>{t("checkout.amount")}</dt>
            <dd data-tk="checkout-amount">Rs {money(payment.amount)}</dd>
          </div>
          <div>
            <dt>{t("recharge.credits")}</dt>
            <dd>{money(payment.credits)}</dd>
          </div>
        </dl>

        {phase === "ready" && !crypto ? (
          <>
            <p className="tkc-marks">
              <VisaMark size={40} /> <MastercardMark size={40} />
            </p>
            <p className="tkc-note">{t("checkout.note")}</p>
            <div className="tkc-actions">
              <button type="button" className="tkc-pay" data-tk="checkout-pay" onClick={() => confirm("paid")}>
                {t("checkout.pay", { amount: money(payment.amount) })}
              </button>
              <button type="button" className="tkc-cancel" data-tk="checkout-cancel" onClick={() => confirm("cancelled")}>
                {t("checkout.cancel")}
              </button>
            </div>
          </>
        ) : null}

        {phase === "ready" && crypto && !picked ? (
          <>
            <p className="tkc-label" id="tkc-coin">{t("checkout.crypto.coin")}</p>
            <div className="tkc-coins" role="radiogroup" aria-labelledby="tkc-coin">
              {COINS.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="radio"
                  aria-checked={coin === item}
                  className="tkc-coin"
                  data-tk={`coin-${item}`}
                  onClick={() => {
                    setCoin(item);
                    if (item !== "USDT" && item !== "USDC") setNetwork("");
                  }}
                >
                  <CoinMark coin={item} size={28} />
                  <span>{item}</span>
                </button>
              ))}
            </div>
            {stable ? (
              <>
                <p className="tkc-label" id="tkc-network">{t("checkout.crypto.network")}</p>
                <div className="tkc-networks" role="radiogroup" aria-labelledby="tkc-network">
                  {NETWORKS.map((item) => (
                    <button key={item} type="button" role="radio" aria-checked={network === item} className="tkc-network" data-tk={`network-${item}`} onClick={() => setNetwork(item)}>
                      {item}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            <p className="tkc-note">{t("checkout.note")}</p>
            <div className="tkc-actions">
              <button type="button" className="tkc-pay" data-tk="coin-continue" disabled={!coin || (stable && !network)} onClick={choose}>
                {t("checkout.crypto.continue")}
              </button>
              <button type="button" className="tkc-cancel" data-tk="checkout-cancel" onClick={() => confirm("cancelled")}>
                {t("checkout.cancel")}
              </button>
            </div>
          </>
        ) : null}

        {phase === "ready" && crypto && picked ? (
          <>
            <p className="tkc-coinamount" data-tk="crypto-amount">
              <CoinMark coin={payment.coin ?? "BTC"} size={28} />
              <strong>
                {payment.cryptoAmount} {payment.coin}
              </strong>
              <span className="tkc-estimate">{t("checkout.crypto.estimate")}</span>
              {payment.network ? <span className="tkc-chip">{payment.network}</span> : null}
            </p>
            <p className="tkc-note">{t("checkout.crypto.send")}</p>
            <div className="tkc-addrrow">
              <div className="tkc-qr">
                <MockQr value={payment.depositAddress ?? ""} label={t("checkout.crypto.qr")} />
              </div>
              <div className="tkc-addr">
                <p className="tkc-label">{t("checkout.crypto.address")}</p>
                <code data-tk="deposit-address">{payment.depositAddress}</code>
                <button type="button" className="tkc-copy" data-tk="copy-address" onClick={copy}>
                  <Copy size={16} aria-hidden /> {copied ? t("checkout.crypto.copied") : t("checkout.crypto.copy")}
                </button>
              </div>
            </div>
            <p className="tkc-timer" data-tk="crypto-timer">
              {t("checkout.crypto.timer")}: <strong>{clock(left)}</strong>
            </p>
            <div className="tkc-actions">
              <button type="button" className="tkc-pay" data-tk="crypto-paid" onClick={() => confirm("paid")}>
                {t("checkout.crypto.paid")}
              </button>
              <button type="button" className="tkc-cancel" data-tk="checkout-cancel" onClick={() => confirm("cancelled")}>
                {t("checkout.cancel")}
              </button>
            </div>
          </>
        ) : null}

        {busy ? (
          <div className="tkc-state" role="status" data-tk="checkout-busy">
            <span className="tkc-spin" aria-hidden />
            <p className="tkc-state-title">{phase === "waiting" ? t("checkout.crypto.waiting") : t("checkout.processing")}</p>
            <p className="tkc-note">{phase === "waiting" ? t("checkout.crypto.waitingNote") : t("checkout.processingNote")}</p>
          </div>
        ) : null}
        {phase === "paid" ? (
          <div className="tkc-state is-ok" role="status" data-tk="checkout-paid">
            <p className="tkc-state-title">{t("checkout.paid")}</p>
            <p className="tkc-note">{t("checkout.paidNote")}</p>
          </div>
        ) : null}
        {phase === "cancelled" || phase === "expired" || phase === "closed" ? (
          <div className="tkc-state is-bad" role="status" data-tk="checkout-ended">
            <p className="tkc-state-title">{phase === "cancelled" ? t("checkout.cancelled") : phase === "expired" ? t("checkout.crypto.expired") : t("checkout.closed")}</p>
            <p className="tkc-note">{t("recharge.failed")}</p>
            <a className="tkc-pay tkc-back" href={backUrl(payment, "failed")} data-tk="checkout-back">
              {t("checkout.back")}
            </a>
          </div>
        ) : null}
        {error ? (
          <p className="tkc-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
