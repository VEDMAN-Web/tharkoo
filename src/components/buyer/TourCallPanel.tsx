"use client";

import Link from "next/link";
import { useState } from "react";

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

export function TourCallPanel({ call, error = "" }: { call: TourCall; error?: string }) {
  const [joined, setJoined] = useState(false);
  const note = stateLine(call, error);
  return (
    <section className="up-glass up-panel" aria-labelledby="tour-call-title" data-tk="tour-call">
      <h1 id="tour-call-title" className="up-h2">Live video call</h1>
      {call.title ? <p className="up-muted">{call.title}</p> : null}
      <p className="up-lead" data-tk="call-rules">{CALL_RULES}</p>
      {note ? <p role="status" className="up-muted">{note}</p> : null}
      <div className="up-promo-row" style={{ marginTop: 16 }}>
        {!note && !joined ? (
          <button type="button" className="up-btn" onClick={() => setJoined(true)}>Join the call</button>
        ) : null}
        <Link href={`/submit-report/?ad=${call.report}`} className="up-btn-ghost" data-tk="call-report">Report</Link>
      </div>
      {joined && call.joinUrl ? (
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
