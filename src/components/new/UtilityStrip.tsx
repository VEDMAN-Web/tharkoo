"use client";

import { Check, Lock, Phone, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { makeT, type UiTextMap } from "@/lib/ui/text";
import "./utility-strip.css";

const TICKER_KEYS = ["home.utility.ticker1", "home.utility.ticker2", "home.utility.ticker3"] as const;
const TICKER_STEP_MS = 3500;
const PHONE_PLACEHOLDER_HREF = "tel:+910000000000";

export function UtilityStrip({ texts }: { texts?: UiTextMap }) {
  const t = makeT(texts);
  const lines = TICKER_KEYS.map((key) => (texts && key in texts ? texts[key].trim() : t(key))).filter(Boolean);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (lines.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setStep((s) => s + 1), TICKER_STEP_MS);
    return () => window.clearInterval(timer);
  }, [lines.length]);

  const index = lines.length ? step % lines.length : 0;
  const current = lines[index] ?? "";

  return (
    <div className="tkh-utility" data-tk="top-bar">
      <div className="tkh-utility-in">
        <ul className="tkh-ub-pills" tabIndex={0} aria-label="Site highlights">
          <li className="tkh-ub-pill tkh-ub-live">
            <i className="tkh-ub-dot" aria-hidden="true" />
            {t("home.utility.live")}
          </li>
          <li className="tkh-ub-pill tkh-ub-verified">
            <Check size={13} strokeWidth={2.4} aria-hidden="true" focusable="false" />
            {t("home.utility.verified")}
          </li>
          <li className="tkh-ub-pill tkh-ub-private">
            <Lock size={13} strokeWidth={2.2} aria-hidden="true" focusable="false" />
            {t("home.utility.private")}
          </li>
        </ul>
        <div className="tkh-ub-right">
          {current ? (
            <p className="tkh-ub-ticker">
              <Sparkles className="tkh-ub-spark" size={14} strokeWidth={2} aria-hidden="true" focusable="false" />
              <span key={step} className="tkh-ub-line">
                {current}
              </span>
            </p>
          ) : null}
          <a className="tkh-ub-phone" href={PHONE_PLACEHOLDER_HREF}>
            <Phone size={13} strokeWidth={2.2} aria-hidden="true" focusable="false" />
            {t("home.utility.phone")}
          </a>
        </div>
      </div>
    </div>
  );
}
