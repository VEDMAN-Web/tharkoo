"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Info, Lock, Video } from "lucide-react";
import { useT } from "@/components/help/UiTextProvider";
import type { EarnInfo } from "@/components/vendor/TourInbox";

/**
 * H21.5a: the "Video calls" row of the Review step. Active only with TOP or Super Top (locked and grey for Free). A switch, On by default, and an
 * (i) button that opens the rules inline (not a floating tip). The switch value is kept as the listing field `videoCallsOff`.
 */
export function VideoCallRow({ boosted, on, onToggle, earn }: { boosted: boolean; on: boolean; onToggle: () => void; earn: EarnInfo | null }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rupees = earn?.options[0]?.rupees;
  if (!boosted) {
    return (
      <div className="tkr-vc is-locked" data-tk="video-row" data-state="locked">
        <span className="tkr-vc-main">
          <Lock size={20} aria-hidden="true" focusable="false" />
          <span className="tkr-vc-text">
            <b>{t("post.v2.rev.vcTitle")}</b>
            <span>{t("post.v2.rev.vcLocked")}</span>
          </span>
        </span>
        <button type="button" role="switch" aria-checked="false" aria-disabled="true" aria-label={`${t("post.v2.rev.vcTitle")}, ${t("post.v2.rev.vcLocked")}`} className="tkr-sw" data-tk="video-switch">
          <span />
        </button>
      </div>
    );
  }
  return (
    <div className="tkr-vc-wrap" data-tk="video-row" data-state={on ? "on" : "off"}>
      <div className="tkr-vc">
        <span className="tkr-vc-main">
          <Video size={20} aria-hidden="true" focusable="false" />
          <span className="tkr-vc-text">
            <b>{t("post.v2.rev.vcTitle")}</b>
            {rupees !== undefined ? <span>{t("post.v2.rev.vcEarn", { rupees })}</span> : null}
          </span>
          <button type="button" className="tkr-i" aria-expanded={open} aria-controls={panelId} aria-label={t("post.v2.rev.vcInfo")} data-tk="video-info" onClick={() => setOpen((v) => !v)}>
            <Info size={16} aria-hidden="true" focusable="false" />
          </button>
        </span>
        <span className="tkr-vc-side">
          <span className="tkr-vc-word">{on ? t("post.v2.rev.vcOn") : t("post.v2.rev.vcOff")}</span>
          <button type="button" role="switch" aria-checked={on} aria-label={t("post.v2.rev.vcTitle")} className={`tkr-sw${on ? " on" : ""}`} data-tk="video-switch" onClick={onToggle}>
            <span />
          </button>
        </span>
      </div>
      {open ? (
        <div id={panelId} className="tkr-vc-panel" data-tk="video-info-panel">
          <div>
            <b>{t("post.v2.rev.vcWhyTitle")}</b>
            <p>{t("post.v2.rev.vcWhy", { rupees: rupees ?? "" })}</p>
          </div>
          <div>
            <b>{t("post.v2.rev.vcRulesTitle")}</b>
            <ul>
              {(["vcRule1", "vcRule2", "vcRule3", "vcRule4", "vcRule5"] as const).map((key) => (
                <li key={key}>{t(`post.v2.rev.${key}`)}</li>
              ))}
            </ul>
          </div>
          <Link href="/terms/" target="_blank" rel="noopener">{t("post.v2.rev.vcGuidelines")}</Link>
        </div>
      ) : null}
    </div>
  );
}
