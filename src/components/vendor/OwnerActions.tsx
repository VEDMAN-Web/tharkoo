"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, friendlyError } from "@/lib/ui/api";
import { draftPath, isDraftStatus } from "@/lib/ui/ad-status";
import { openPromote } from "@/components/promote/openPromote";
import { makeT } from "@/lib/ui/text";
import "./video-switch.css";

const t = makeT();

type Action = "pause" | "resume" | "renew" | "duplicate" | "delete";

const CONFIRM_MS = 4000;
/** "28 Nov, 3:40 pm" in Indian time, so the label means the same on the server and in the browser. */
const PROMO_DATE = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
const FINISH_STEP = 5;

/**
 * H7.5: the owner buttons under an ad in the vendor panel. Which ones show depends on the ad's status:
 * live ads can be paused (and renewed when they end soon), paused ads resume, ended ads are posted again.
 */
export function OwnerActions({
  id,
  status,
  endsSoon,
  title,
  videoCallsEligible = false,
  videoCallsOff = false,
  promotion = null,
  onDone,
}: {
  id: string;
  status?: string;
  endsSoon: boolean;
  title?: string;
  /** TOP or Super Top is running on this ad: only then the video calls switch shows. */
  videoCallsEligible?: boolean;
  videoCallsOff?: boolean;
  /** A promotion running on this ad now (its plan name and when it ends). Shown as a label so the owner can see the ad is promoted. */
  promotion?: { name: string; endsAt: string } | null;
  onDone: (message: string) => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const timer = useRef(0);
  const draft = isDraftStatus(status);
  const [callsOff, setCallsOff] = useState(videoCallsOff);
  const canSwitchCalls = status === "active" && videoCallsEligible;

  useEffect(() => () => window.clearTimeout(timer.current), []);
  const actions: Action[] = [];
  if (status === "active") actions.push("pause");
  if (status === "paused") actions.push("resume");
  if (status === "active" && endsSoon) actions.push("renew");
  if (status === "expired" || status === "archived") actions.push("duplicate");
  actions.push("delete");

  async function run(action: Action) {
    setBusy(true);
    const res = action === "delete"
      ? await api(`/api/listings/${id}`, { method: "DELETE" })
      : await api(`/api/listings/${id}/${action}`, { method: "POST", body: "{}" });
    setBusy(false);
    await onDone(res.ok ? LABEL_DONE[action] : friendlyError(res.error));
  }

  async function toggleCalls() {
    const next = !callsOff;
    setBusy(true);
    const res = await api(`/api/listings/${id}`, { method: "PATCH", body: JSON.stringify({ stage: "details", videoCallsOff: next }) });
    setBusy(false);
    if (res.ok) setCallsOff(next);
    await onDone(res.ok ? (next ? "Video calls are off." : "Video calls are on.") : friendlyError(res.error));
  }

  function tapDelete() {
    if (!confirming) {
      setConfirming(true);
      timer.current = window.setTimeout(() => setConfirming(false), CONFIRM_MS);
      return;
    }
    window.clearTimeout(timer.current);
    setConfirming(false);
    void run("delete");
  }

  return (
    <div className="tkv-owner-buttons">
      {draft ? <p className="tkv-owner-note">Not live yet. Finish the steps to send it for review.</p> : null}
      {status === "active" && promotion ? (
        <p className="tkv-promo-chip" data-tk="promoted-chip">
          <span aria-hidden="true">★</span> {promotion.name} · ends {PROMO_DATE.format(new Date(promotion.endsAt))}
        </p>
      ) : null}
      {draft ? <Link href={draftPath(id, FINISH_STEP)} className="tkv-mini tkv-mini-primary">Finish your ad</Link> : null}
      {status === "active" ? (
        <button type="button" className="tkv-mini tkv-mini-primary" data-tk="promote-open" onClick={() => openPromote({ listingId: id, title })}>
          {t("promote.button")}
        </button>
      ) : null}
      {canSwitchCalls ? (
        <button type="button" role="switch" aria-checked={!callsOff} className="tkv-video-switch" data-tk="video-calls-toggle" disabled={busy} onClick={toggleCalls}>
          <span className="tkv-video-switch-track" aria-hidden="true" />
          <span>Video calls <span className="tkv-video-state">{callsOff ? "Off" : "On"}</span></span>
        </button>
      ) : null}
      <Link href={draftPath(id)} className="tkv-mini">Edit</Link>
      {actions.map((action) =>
        action === "delete" ? (
          <button key={action} type="button" className={`tkv-mini ${confirming ? "tkv-mini-confirm" : "tkv-mini-quiet"}`} disabled={busy} onClick={tapDelete}>
            {confirming ? "Tap again to delete" : LABEL[action]}
          </button>
        ) : (
          <button key={action} type="button" className="tkv-mini tkv-mini-strong" disabled={busy} onClick={() => run(action)}>
            {LABEL[action]}
          </button>
        ),
      )}
    </div>
  );
}

const LABEL: Record<Action, string> = {
  pause: "Pause",
  resume: "Resume",
  renew: "Renew",
  duplicate: "Post again",
  delete: "Delete",
};

const LABEL_DONE: Record<Action, string> = {
  pause: "Paused.",
  resume: "Live again.",
  renew: "Renewed for another run.",
  duplicate: "Copied as a new draft. Find it under All.",
  delete: "Deleted.",
};
