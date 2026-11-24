"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { useT } from "@/components/ui/AdCard";
import { openRecharge } from "@/components/recharge/openRecharge";
import { PlanChoice } from "./PlanChoice";
import { CREDITS_ADDED_EVENT } from "@/components/post/credits";
import { api, friendlyError, hasSessionHint, idempotencyKey } from "@/lib/ui/api";
import type { PromoteOptions } from "./openPromote";
import "@/components/recharge/recharge.css";
import "./promote.css";

type Plan = { id: string; code: string; name: string; description: string; amount: number; durationHours: number };
type Done = { name: string; endsAt: string | null; balance: number };

const money = (value: number) => value.toLocaleString("en-IN");

function firstPlanId(list: Plan[], wanted: string): string {
  const match = list.find((plan) => plan.id === wanted || plan.code === wanted);
  return match ? match.id : (list[0]?.id ?? "");
}

/** H7.116: the plans an owner can buy for one live ad, paid with credits. Short on credits it hands over to the recharge sheet. */
export function PromoteSheet({ options, onClose }: { options: PromoteOptions; onClose: () => void }) {
  const t = useT();
  const router = useRouter();
  const [signedIn] = useState(() => hasSessionHint());
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [selected, setSelected] = useState(options.planId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Done | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  const keyRef = useRef<{ plan: string; key: string } | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    Promise.all([api<{ products: Plan[] }>("/api/promotions/products"), api<{ balance: number }>("/api/wallet/")]).then(([products, wallet]) => {
      if (!live) return;
      if (!products.ok) return setError(friendlyError(products.error));
      const list = (products.data.products || []).filter((plan) => plan.amount > 0 && plan.code !== "free");
      setPlans(list);
      setBalance(wallet.ok ? Number(wallet.data.balance) || 0 : 0);
      setSelected((current) => firstPlanId(list, current));
    });
    return () => {
      live = false;
    };
  }, [signedIn]);

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

  const chosen = plans?.find((plan) => plan.id === selected);
  const have = balance ?? 0;
  const short = chosen ? Math.max(0, chosen.amount - have) : 0;

  const recharge = useCallback(() => {
    onClose();
    openRecharge({ shortfall: short, shortKey: "recharge.short.promote", wallet: "ad" });
  }, [onClose, short]);

  const promote = useCallback(async () => {
    if (!chosen || busy || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    // One key per sheet open and plan, reused for every click, so a repeated click can never be a second purchase.
    if (keyRef.current?.plan !== chosen.id) keyRef.current = { plan: chosen.id, key: idempotencyKey(`promote-${options.listingId}-${chosen.id}`) };
    const key = keyRef.current.key;
    const res = await api<{ endsAt: string | null; balance: number }>("/api/promotions", {
      method: "POST",
      body: JSON.stringify({ listingId: options.listingId, productId: chosen.id, idempotencyKey: key }),
    });
    inFlight.current = false;
    setBusy(false);
    if (!res.ok) {
      keyRef.current = null;
      if (res.status === 402) {
        const wallet = await api<{ balance: number }>("/api/wallet/");
        return setBalance(wallet.ok ? Number(wallet.data.balance) || 0 : 0);
      }
      return setError(res.status === 409 && res.error.message ? res.error.message : friendlyError(res.error));
    }
    setDone({ name: chosen.name, endsAt: res.data.endsAt ?? null, balance: Number(res.data.balance) || 0 });
    window.dispatchEvent(new CustomEvent(CREDITS_ADDED_EVENT, { detail: { added: 0 } }));
    router.refresh();
  }, [chosen, busy, options.listingId, router]);

  const nextPath = typeof window === "undefined" ? "/" : `${window.location.pathname}${window.location.search}`;

  return (
    <div className="tkr-wrap" data-tk="promote-wrap" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="tkr-sheet tkpr-sheet" role="dialog" aria-modal="true" aria-labelledby="tkpr-title" tabIndex={-1} ref={panel} data-tk="promote-sheet">
        <div className="tkr-head">
          <div>
            <h2 id="tkpr-title">{t("promote.title")}</h2>
            {options.title ? <p className="tkr-rate tkpr-ad" data-tk="promote-ad">{options.title}</p> : null}
          </div>
          <button type="button" className="tkr-x" aria-label={t("recharge.close")} onClick={onClose}>
            <X size={20} aria-hidden />
          </button>
        </div>
        {done ? (
          <div className="tkpr-done" data-tk="promote-done" role="status">
            <span className="tkpr-done-icon" aria-hidden="true"><Check size={26} /></span>
            <p className="tkpr-done-title">{t("promote.done", { name: done.name })}</p>
            {done.endsAt ? <p className="tkpr-muted">{t("promote.until", { date: new Date(done.endsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) })}</p> : null}
            <p className="tkpr-muted" data-tk="promote-left">{t("promote.left", { count: money(done.balance) })}</p>
          </div>
        ) : !signedIn ? (
          <p className="tkr-note">
            {t("promote.login")} <a href={`/u/login/?next=${encodeURIComponent(nextPath)}`} className="tkr-link">{t("recharge.loginLink")}</a>
          </p>
        ) : !plans ? (
          <p className="tkr-note" role="status">{error || t("promote.loading")}</p>
        ) : plans.length === 0 ? (
          <p className="tkr-note">{t("promote.empty")}</p>
        ) : (
          <>
            <p className="tkpr-balance" data-tk="promote-balance">{t("promote.balance", { count: money(have) })}</p>
            <div role="radiogroup" aria-label={t("promote.plans")} className="tkpr-plans">
              {plans.map((plan) => (
                <PlanChoice
                  key={plan.id}
                  id={plan.code}
                  name={plan.name}
                  price={t("promote.price", { count: money(plan.amount) })}
                  text={plan.description}
                  extra={plan.durationHours === 1 ? t("promote.hour") : t("promote.hours", { count: plan.durationHours })}
                  tip={`${plan.description} ${t("promote.tip", { count: money(plan.amount) })}`}
                  selected={plan.id === selected}
                  onSelect={() => setSelected(plan.id)}
                />
              ))}
            </div>
            {short > 0 ? <p className="tkr-short" data-tk="promote-short">{t("promote.short", { count: money(short) })}</p> : null}
            {error ? <p className="tkr-error" role="alert">{error}</p> : null}
            {short > 0 ? (
              <button type="button" className="tkr-pay" data-tk="promote-recharge" onClick={recharge}>{t("promote.recharge")}</button>
            ) : (
              <button type="button" className="tkr-pay" data-tk="promote-pay" disabled={!chosen || busy} onClick={promote}>
                {busy ? t("promote.working") : chosen ? t("promote.cta", { count: money(chosen.amount) }) : t("promote.title")}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
