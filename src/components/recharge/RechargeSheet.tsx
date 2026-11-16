"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Lock, X } from "lucide-react";
import { useT } from "@/components/ui/AdCard";
import { api, friendlyError, hasSessionHint, idempotencyKey } from "@/lib/ui/api";
import type { RechargePack } from "@/server/billing/recharge";
import { BitcoinMark, EthereumMark, MastercardMark, UsdcMark, UsdtMark, VisaMark } from "./PayMarks";
import { openSupportWith, rechargeLine, type RechargeOptions } from "./openRecharge";
import "./recharge.css";

type SheetData = { packs: RechargePack[]; balance: number; creditPriceInr: number; available: boolean };
type Method = "card" | "crypto";

const money = (value: number) => value.toLocaleString("en-IN");

export function pickPack(packs: RechargePack[], shortfall: number): string {
  if (packs.length === 0) return "";
  if (shortfall > 0) return (packs.find((pack) => pack.total >= shortfall) ?? packs[packs.length - 1]).id;
  return (packs.find((pack) => pack.badge === "popular") ?? packs[0]).id;
}

export function RechargeSheet({ options, onClose }: { options: RechargeOptions; onClose: () => void }) {
  const t = useT();
  const shortfall = Math.max(0, Math.floor(options.shortfall ?? 0));
  const [data, setData] = useState<SheetData | null>(null);
  const [signedIn] = useState(() => hasSessionHint());
  const [selected, setSelected] = useState("");
  const [method, setMethod] = useState<Method>("card");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    api<SheetData>(`/api/payments/packs${shortfall > 0 ? `?shortfall=${shortfall}` : ""}`).then((res) => {
      if (!live) return;
      if (!res.ok) return setError(friendlyError(res.error));
      setData(res.data);
      setSelected(pickPack(res.data.packs, shortfall));
    });
    return () => {
      live = false;
    };
  }, [signedIn, shortfall]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, [onClose]);

  const chosen = data?.packs.find((pack) => pack.id === selected);

  const pay = useCallback(async () => {
    if (!chosen || busy) return;
    setBusy(true);
    setError("");
    const returnTo = options.returnTo || `${window.location.pathname}${window.location.search}`;
    const res = await api<{ paymentId: string; checkoutPath: string }>("/api/payments/recharge", {
      method: "POST",
      body: JSON.stringify({ packId: chosen.id, method, returnTo, idempotencyKey: idempotencyKey(chosen.id) }),
    });
    if (!res.ok) {
      setBusy(false);
      return setError(res.status === 409 ? t("recharge.unavailable") : friendlyError(res.error) || t("recharge.error"));
    }
    window.location.assign(res.data.checkoutPath);
  }, [chosen, busy, method, options.returnTo, t]);

  function contactSupport() {
    onClose();
    openSupportWith(rechargeLine({ pack: chosen ? `${money(chosen.total)} credits` : undefined, amount: chosen?.price, method: method === "card" ? "Card" : "Crypto" }));
  }

  const nextPath = typeof window === "undefined" ? "/" : `${window.location.pathname}${window.location.search}`;

  return (
    <div className="tkr-wrap" data-tk="recharge-wrap" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="tkr-sheet" role="dialog" aria-modal="true" aria-labelledby="tkr-title" tabIndex={-1} ref={panel} data-tk="recharge-sheet">
        <div className="tkr-head">
          <div>
            <h2 id="tkr-title">{t("recharge.title")}</h2>
            <p className="tkr-rate">{t("recharge.rate", { price: data?.creditPriceInr ?? 10 })}</p>
          </div>
          <button type="button" className="tkr-x" aria-label={t("recharge.close")} onClick={onClose}>
            <X size={20} aria-hidden />
          </button>
        </div>
        {!signedIn ? (
          <p className="tkr-note">
            {t("recharge.login")}{" "}
            <a href={`/u/login/?next=${encodeURIComponent(nextPath)}`} className="tkr-link">{t("recharge.loginLink")}</a>
          </p>
        ) : !data ? (
          <p className="tkr-note" role="status">{error || t("recharge.loading")}</p>
        ) : data.packs.length === 0 ? (
          <p className="tkr-note">{t("recharge.empty")}</p>
        ) : (
          <>
            {shortfall > 0 ? <p className="tkr-short" data-tk="recharge-short">{t(options.shortKey ?? "recharge.short", { count: shortfall })}</p> : null}
            <div role="radiogroup" aria-label={t("recharge.packs")} className="tkr-packs">
              {data.packs.map((pack) => (
                <button key={pack.id} type="button" role="radio" aria-checked={pack.id === selected} className="tkr-pack" data-tk="recharge-pack" onClick={() => setSelected(pack.id)}>
                  {pack.badge ? <span className={`tkr-badge is-${pack.badge}`}>{t(pack.badge === "popular" ? "recharge.badge.popular" : "recharge.badge.best")}</span> : null}
                  <span className="tkr-credits">
                    <strong>{money(pack.total)}</strong> {t("recharge.credits")}
                  </span>
                  <span className="tkr-price">
                    ₹{money(pack.price)}
                    {pack.bonus > 0 ? <em>{t("recharge.bonus", { count: money(pack.bonus) })}</em> : null}
                  </span>
                </button>
              ))}
            </div>
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
              {busy ? t("recharge.starting") : chosen ? t("recharge.pay", { amount: money(chosen.price) }) : t("recharge.packs")}
            </button>
          </>
        )}
        <div className="tkr-foot">
          <span>
            {t("recharge.help")}{" "}
            <button type="button" className="tkr-link" data-tk="recharge-support" onClick={contactSupport}>{t("recharge.contact")}</button>
          </span>
          <span className="tkr-secure">
            <Lock size={14} aria-hidden /> {t("recharge.secure")}
          </span>
        </div>
      </div>
    </div>
  );
}
