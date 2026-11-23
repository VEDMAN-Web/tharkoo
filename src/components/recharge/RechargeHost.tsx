"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSitePath } from "@/components/useSitePath";
import { useT } from "@/components/ui/AdCard";
import { RechargeSheet } from "./RechargeSheet";
import { RECHARGE_EVENT, openRecharge, openSupportWith, rechargeLine, type RechargeOptions } from "./openRecharge";
import "./recharge.css";

type Result = { kind: "paid" | "failed"; credits: number };

export function RechargeHost() {
  const t = useT();
  const router = useRouter();
  const path = useSitePath();
  const params = useSearchParams();
  const [options, setOptions] = useState<RechargeOptions | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const status = params.get("recharge");
  const credits = Number(params.get("credits") || 0);
  // H19.3: the way back to an ad page with the video call pop-up (?call=1), read while drawing, before anything strips it.
  const popupReturn = params.get("call") === "1";

  useEffect(() => {
    const onOpen = (event: Event) => setOptions((event as CustomEvent<RechargeOptions>).detail ?? {});
    window.addEventListener(RECHARGE_EVENT, onOpen);
    return () => window.removeEventListener(RECHARGE_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (status !== "paid" && status !== "failed") return;
    const next = new URLSearchParams(window.location.search);
    next.delete("recharge");
    next.delete("credits");
    next.delete("payment");
    const query = next.toString();
    window.history.replaceState(null, "", `${path}${query ? `?${query}` : ""}`);
    // H19.3: coming back to an ad page with the video call pop-up open, the pop-up says it itself; no second message.
    const id = window.setTimeout(() => {
      if (!(popupReturn && status === "paid")) setResult({ kind: status, credits });
      if (status === "paid") {
        router.refresh();
        window.dispatchEvent(new CustomEvent("tk:credits-added", { detail: { added: 0 } }));
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [status, credits, path, router, popupReturn]);

  useEffect(() => {
    if (!result || result.kind !== "paid") return;
    const id = window.setTimeout(() => setResult(null), 6000);
    return () => window.clearTimeout(id);
  }, [result]);

  const close = useCallback(() => setOptions(null), []);

  return (
    <>
      {options ? <RechargeSheet options={options} onClose={close} /> : null}
      {result ? (
        <div className={`tkr-toast is-${result.kind}`} role="status" data-tk="recharge-result" data-result={result.kind}>
          {result.kind === "paid" ? (
            <p>{t("recharge.added", { count: result.credits.toLocaleString("en-IN") })}</p>
          ) : (
            <>
              <p>{t("recharge.failed")}</p>
              <p className="tkr-toast-actions">
                <button type="button" className="tkr-link" data-tk="recharge-retry" onClick={() => { setResult(null); openRecharge({}); }}>{t("recharge.tryAgain")}</button>
                <button type="button" className="tkr-link" onClick={() => { setResult(null); openSupportWith(rechargeLine({})); }}>{t("recharge.contact")}</button>
              </p>
            </>
          )}
          <button type="button" className="tkr-toast-x" aria-label={t("recharge.close")} onClick={() => setResult(null)}>×</button>
        </div>
      ) : null}
    </>
  );
}
