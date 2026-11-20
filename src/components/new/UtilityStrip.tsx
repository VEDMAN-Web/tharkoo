"use client";

import { Check, Lock, Phone, Sparkles } from "lucide-react";
import type { CSSProperties } from "react";
import { makeT, type UiTextMap } from "@/lib/ui/text";
import { telHref } from "@/lib/support";
import "./utility-strip.css";

const TICKER_KEYS = ["home.utility.ticker1", "home.utility.ticker2", "home.utility.ticker3"] as const;
const CRAWL_PX_PER_SECOND = 40;
const CRAWL_CHAR_PX = 7;
const CRAWL_ITEM_PX = 48;
const CRAWL_MIN_SET_PX = 1400;

function crawlPlan(lines: string[]) {
  const setPx = lines.reduce((sum, line) => sum + line.length * CRAWL_CHAR_PX + CRAWL_ITEM_PX, 0);
  const repeats = Math.max(1, Math.ceil(CRAWL_MIN_SET_PX / Math.max(setPx, 1)));
  return { sets: repeats * 2, seconds: Math.round((setPx * repeats) / CRAWL_PX_PER_SECOND) };
}

export function UtilityStrip({ texts }: { texts?: UiTextMap }) {
  const t = makeT(texts);
  const lines = TICKER_KEYS.map((key) => (texts && key in texts ? texts[key].trim() : t(key))).filter(Boolean);
  const plan = crawlPlan(lines);
  const phone = t("home.utility.phone");
  const phoneHref = telHref(phone);

  return (
    <div className="tkh-utility" data-tk="top-bar">
      <div className="tkn-wrap tkh-utility-in">
        <ul className="tkh-ub-pills" aria-label="Site highlights">
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
        {lines.length ? (
          <div className="tkh-ub-crawl" data-tk="top-bar-crawl" role="group" aria-label="Site news" tabIndex={0}>
            <div className="tkh-ub-track" style={{ "--ub-seconds": `${plan.seconds}s` } as CSSProperties}>
              {Array.from({ length: plan.sets }, (_, set) => (
                <ul key={set} className="tkh-ub-set" aria-hidden={set > 0 ? "true" : undefined}>
                  {lines.map((line, index) => (
                    <li key={index} className="tkh-ub-item">
                      <Sparkles className="tkh-ub-spark" size={14} strokeWidth={2} aria-hidden="true" focusable="false" />
                      {line}
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        ) : (
          <span className="tkh-ub-crawl" aria-hidden="true" />
        )}
        {phoneHref ? (
          <a className="tkh-ub-phone" data-tk="top-bar-phone" href={phoneHref}>
            <Phone size={13} strokeWidth={2.2} aria-hidden="true" focusable="false" />
            {phone}
          </a>
        ) : null}
      </div>
    </div>
  );
}
