"use client";

import Link from "next/link";
import { Video } from "lucide-react";
import { useSitePath } from "@/components/useSitePath";
import { callPage, useTours } from "@/components/tours/useTours";

/**
 * One line under the header, on every page, for a video call that needs this person now:
 * - the advertiser: someone wants a video call (pink, "Answer now" opens the Video calls page);
 * - the person who asked: the advertiser accepted (violet, "Join now").
 * It checks every 5 seconds while a call is open and every 10 seconds otherwise, and goes away once the call is answered, joined, ended or cancelled.
 */
export function CallStrip() {
  const { rows } = useTours({ slowMs: 10_000 });
  const path = useSitePath();
  // Not in the admin, and not on the call page itself (the person is already joining).
  if (path.startsWith("/admin") || path.startsWith("/u/account/tours/")) return null;
  const waiting = (rows ?? []).filter((row) => row.role === "advertiser" && row.status === "requested").length;
  const accepted = (rows ?? []).filter((row) => row.role === "buyer" && row.status === "accepted");
  // On the Video calls page the requests are right there, so the pink line would only repeat them.
  const showWaiting = waiting > 0 && !path.startsWith("/u/account/calls/");
  if (!showWaiting && accepted.length === 0) return null;
  const first = accepted[0];
  return (
    <>
      {showWaiting ? (
        <div role="status" aria-live="polite" className="tkn-call-strip tkn-call-strip-vendor" data-tk="vendor-call-waiting">
          <Video size={18} aria-hidden="true" />
          <span>{waiting === 1 ? "Someone wants a video call with you." : `${waiting} people want a video call with you.`}</span>
          <Link href="/u/account/calls/" className="tkn-call-strip-btn" data-tk="vendor-call-answer">
            Answer now
          </Link>
        </div>
      ) : null}
      {accepted.length > 0 ? (
        <div role="status" aria-live="polite" className="tkn-call-strip" data-tk="buyer-call-ready">
          <Video size={18} aria-hidden="true" />
          <span>
            {accepted.length === 1
              ? `${first.otherName && first.otherName !== "Member" ? first.otherName : "The advertiser"} accepted your video call.`
              : `${accepted.length} of your video calls were accepted.`}
          </span>
          <Link href={accepted.length === 1 ? callPage(first.id) : "/u/account/calls/"} className="tkn-call-strip-btn" data-tk="buyer-call-join">
            {accepted.length === 1 ? "Join now" : "See calls"}
          </Link>
        </div>
      ) : null}
    </>
  );
}
