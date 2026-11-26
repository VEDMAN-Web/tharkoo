"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, friendlyError } from "@/lib/ui/api";
import { callPage, useTours } from "@/components/tours/useTours";
import type { useT } from "@/components/ui/AdCard";

type T = ReturnType<typeof useT>;

const ENDED_TEXT = {
  declined: "ad.calling.declined",
  expired: "ad.calling.expired",
  failed: "ad.calling.failed",
  cancelled: "ad.calling.cancelled",
} as const;

/**
 * The pop-up step after a video call request: it follows the real request. It shows the place in the line, the Join now
 * button the moment the advertiser accepts, and says so when the request closed and the credit came back.
 */
export function CallingStep({ tourId, name, t, onClose, onEnded }: { tourId: string | null; name: string; t: T; onClose: () => void; onEnded: () => void }) {
  const { rows, reload } = useTours({ fastMs: 4000 });
  const [cancelled, setCancelled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const row = tourId ? rows?.find((item) => item.id === tourId) : undefined;
  const status = cancelled ? "cancelled" : (row?.status ?? "requested");
  const endedKey = status in ENDED_TEXT ? ENDED_TEXT[status as keyof typeof ENDED_TEXT] : null;
  const ended = endedKey !== null;

  useEffect(() => {
    if (ended) onEnded();
  }, [ended, onEnded]);

  async function cancel() {
    if (!tourId) return onClose();
    setBusy(true);
    setError("");
    try {
      const res = await api(`/api/tours/${encodeURIComponent(tourId)}/cancel`, { method: "POST" });
      setBusy(false);
      if (!res.ok) {
        setError(friendlyError(res.error));
        void reload();
        return;
      }
      setCancelled(true);
    } catch {
      setBusy(false);
      setError("Could not reach the server. Please try again.");
    }
  }

  const ahead = row?.ahead ?? 0;
  const line = endedKey
    ? t(endedKey, { name })
    : status === "accepted"
      ? t("ad.calling.accepted", { name })
      : row?.busy
        ? t("ad.calling.busy", { name })
        : ahead > 0
          ? t(ahead === 1 ? "ad.calling.aheadOne" : "ad.calling.aheadMany", { count: ahead })
          : "";

  return (
    <div className="tkn-pop-stack tkn-pop-center" data-tk="calling-step" data-status={status}>
      <span className="tkn-pop-ring" aria-hidden>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#5B21B6" strokeWidth="2.2" aria-hidden>
          <rect x="3" y="6" width="13" height="12" rx="2" />
          <path d="M16 10l5-3v10l-5-3" />
        </svg>
      </span>
      {line ? (
        <p role="status" className="tkn-pop-note">
          {line}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="tkn-pop-note">
          {error}
        </p>
      ) : null}
      {status === "accepted" && tourId ? (
        <Link href={callPage(tourId)} className="tkn-pop-btn" data-tk="calling-join">
          {t("ad.calling.join")}
        </Link>
      ) : null}
      {ended || status === "completed" ? (
        <button type="button" className="tkn-pop-btn-line" onClick={onClose}>
          {t("ad.popup.close")}
        </button>
      ) : (
        <button type="button" className="tkn-pop-btn-line" disabled={busy} onClick={() => void cancel()}>
          {t("ad.calling.cancel")}
        </button>
      )}
    </div>
  );
}
