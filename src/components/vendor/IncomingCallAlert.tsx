"use client";

import { useSitePath } from "@/components/useSitePath";
import { useEffect, useState } from "react";
import { Video } from "lucide-react";
import { api, hasSessionHint } from "@/lib/ui/api";
import { TourInbox } from "./TourInbox";

type Row = { id: string; status: string; role: "advertiser" | "buyer" };

/** How often a signed-in vendor's browser asks for new video call requests. */
const POLL_MS = 20_000;

/**
 * H18.14 (Vedant, 22 Nov 2026): a vendor sees a waiting video call on every page, with one tap to answer it. Requests
 * expire after 30 minutes, so this checks every 20 seconds while the tab is open.
 */
export function IncomingCallAlert() {
  const [waiting, setWaiting] = useState(0);
  // H18.18: the requests open right here, on whatever page the vendor is on (the old link went to a page without them).
  const [open, setOpen] = useState(false);
  const path = useSitePath();
  useEffect(() => {
    if (!hasSessionHint()) return;
    let live = true;
    const check = () => {
      if (document.visibilityState === "hidden") return;
      void api<Row[]>("/api/tours").then((res) => {
        if (live && res.ok) setWaiting(res.data.filter((row) => row.role === "advertiser" && row.status === "requested").length);
      });
    };
    check();
    const timer = window.setInterval(check, POLL_MS);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, []);
  if ((waiting === 0 && !open) || path.startsWith("/admin")) return null;
  return (
    <>
      <div role="status" aria-live="polite" className="tkn-call-alert" data-tk="incoming-call">
        <Video size={18} aria-hidden="true" />
        <span>{waiting === 0 ? "Your video calls" : waiting === 1 ? "Someone wants a video call with you." : `${waiting} people want a video call with you.`}</span>
        <button type="button" className="tkn-call-alert-btn" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? "Close" : "Answer now"}
        </button>
      </div>
      {open ? (
        <div className="tkn-call-alert-panel" data-tk="incoming-call-panel">
          <TourInbox />
        </div>
      ) : null}
    </>
  );
}
