"use client";

import Link from "next/link";

export const CALL_RULES = "Calls are for checking that the person or item is real. No nudity or sexual content. Report anything wrong with the Report button.";

export type TourCall = {
  id: string;
  status: string;
  role: "advertiser" | "buyer";
  title: string;
  report: string;
  joinUrl: string | null;
};

function stateLine(call: TourCall, error: string) {
  if (error) return error;
  if (call.status !== "accepted") return "This video call is not open.";
  if (!call.joinUrl) return "Video calls are not live yet. We will tell you when they open.";
  return "";
}

/**
 * The person already tapped "Join now" to get here, so the room opens at once (no second "Join the call" tap).
 * The rules and the Report button stay on the same screen, above the video.
 */
export function TourCallPanel({ call, error = "" }: { call: TourCall; error?: string }) {
  const note = stateLine(call, error);
  return (
    <section className="up-glass up-panel" aria-labelledby="tour-call-title" data-tk="tour-call">
      <h1 id="tour-call-title" className="up-h2">Live video call</h1>
      {call.title ? <p className="up-muted">{call.title}</p> : null}
      <p className="up-lead" data-tk="call-rules">{CALL_RULES}</p>
      {note ? <p role="status" className="up-muted">{note}</p> : null}
      <div className="up-promo-row" style={{ marginTop: 16 }}>
        <Link href={`/submit-report/?ad=${call.report}`} className="up-btn-ghost" data-tk="call-report">Report</Link>
      </div>
      {!note && call.joinUrl ? (
        <iframe
          title="Live video call"
          src={call.joinUrl}
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          className="up-call-frame"
        />
      ) : null}
    </section>
  );
}
