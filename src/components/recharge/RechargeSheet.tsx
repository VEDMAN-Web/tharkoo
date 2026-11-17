"use client";

import { useEffect, useRef, useState } from "react";
import { Lock, X } from "lucide-react";
import { useT } from "@/components/ui/AdCard";
import { hasSessionHint } from "@/lib/ui/api";
import { preselectedId } from "@/lib/credit-pack-view";
import type { RechargePack } from "@/server/billing/recharge";
import { CreditPacks, useCreditPacks, type PackChoice } from "./CreditPacks";
import { openSupportWith, rechargeLine, type RechargeOptions } from "./openRecharge";
import "./recharge.css";

export function pickPack(packs: RechargePack[], shortfall: number): string {
  return preselectedId(packs, shortfall);
}

/** The recharge sheet of the posting flow and the header pill: the shared pack picker in a dialog. */
export function RechargeSheet({ options, onClose }: { options: RechargeOptions; onClose: () => void }) {
  const t = useT();
  const shortfall = Math.max(0, Math.floor(options.shortfall ?? 0));
  const [signedIn] = useState(() => hasSessionHint());
  const { data, error } = useCreditPacks(shortfall);
  const panel = useRef<HTMLDivElement>(null);
  const choice = useRef<PackChoice | null>(null);

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

  function contactSupport() {
    onClose();
    const picked = choice.current;
    openSupportWith(rechargeLine({ pack: picked ? `${picked.pack.total.toLocaleString("en-IN")} credits` : undefined, amount: picked?.pack.price, method: picked ? (picked.method === "card" ? "Card" : "Crypto") : undefined }));
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
            <div style={{ marginTop: 12 }}>
              <CreditPacks data={data} shortfall={shortfall} returnTo={options.returnTo} onChoice={(next) => { choice.current = next; }} />
            </div>
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

