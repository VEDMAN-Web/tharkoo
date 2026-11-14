"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Video } from "lucide-react";
import { api, friendlyError, hasSessionHint } from "@/lib/ui/api";
import { tourRequestLabel } from "./tourLabels";

const noSubscribe = () => () => {};
const signedOutOnClient = () => !hasSessionHint();
const signedOutOnServer = () => false;

/** "Request live video tour · N coins" on an ad page. The server checks everything again; this only starts the request. */
export function TourRequestButton({ listingId, coins }: { listingId: string; coins: number }) {
  const pathname = usePathname() || "/";
  const signedOut = useSyncExternalStore(noSubscribe, signedOutOnClient, signedOutOnServer);
  const [busy, setBusy] = useState(false);
  const [requested, setRequested] = useState(false);
  const [note, setNote] = useState("");

  if (signedOut && !requested) {
    return (
      <p className="t-small" style={{ marginTop: 12 }}>
        <Link href={`/u/login/?next=${encodeURIComponent(pathname)}`} className="tk-dlink">
          Sign in to request a live video tour
        </Link>
      </p>
    );
  }

  async function request() {
    setBusy(true);
    setNote("");
    const res = await api<{ id: string }>("/api/tours/request", { method: "POST", body: JSON.stringify({ listingId }) });
    setBusy(false);
    if (res.ok) return setRequested(true);
    if (res.status === 401) return setNote("Sign in to request a live video tour.");
    setNote(friendlyError(res.error));
  }

  return (
    <div className="tk-tour-request" style={{ marginTop: 12 }}>
      {requested ? (
        <p role="status" className="t-small">
          Request sent. The advertiser has 30 minutes to accept. The coins are held and refunded if the tour does not go ahead.
        </p>
      ) : (
        <button type="button" className="tk-btn tk-btn-outline-gold" onClick={request} disabled={busy} aria-busy={busy}>
          <Video size={16} aria-hidden /> {tourRequestLabel(coins)}
        </button>
      )}
      {note ? (
        <p role="alert" className="t-small" style={{ color: "var(--danger, #b00020)", marginTop: 6 }}>
          {note}
        </p>
      ) : null}
    </div>
  );
}
