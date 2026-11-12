"use client";

import { useState, useTransition } from "react";
import { approveAction, rejectAction } from "./actions";

export interface PendingAd {
  id: string;
  title: string;
  description: string;
  category: string;
  city: string;
  createdAt: string;
}

export function ModerationRow({ ad }: { ad: PendingAd }) {
  const [done, setDone] = useState("");
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [asking, setAsking] = useState(false);
  const [busy, start] = useTransition();

  function decide(job: () => ReturnType<typeof approveAction>) {
    setError("");
    start(async () => {
      const res = await job();
      if (res.ok) setDone(res.status === "active" ? "Approved and live" : "Rejected");
      else setError(res.error);
    });
  }

  return (
    <li className="adm-card" style={{ display: "grid", gap: 8 }}>
      <div>
        <strong>{ad.title || "(no title)"}</strong>
        <span className="t-small text-muted"> {ad.category} / {ad.city}{ad.createdAt ? ` / ${new Date(ad.createdAt).toLocaleDateString("en-IN")}` : ""}</span>
      </div>
      <p className="t-small" style={{ margin: 0 }}>{ad.description.slice(0, 240)}</p>
      {done ? (
        <p role="status" className="t-small"><strong>{done}</strong></p>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" className="adm-btn" disabled={busy} onClick={() => decide(() => approveAction(ad.id))}>Approve</button>
          {asking ? (
            <>
              <input className="adm-input" style={{ maxWidth: 320 }} aria-label="Reason for rejecting" placeholder="Reason (kept in the audit log)" maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
              <button type="button" className="adm-btn adm-btn-danger" disabled={busy || !reason.trim()} onClick={() => decide(() => rejectAction(ad.id, reason))}>Confirm reject</button>
              <button type="button" className="adm-btn adm-btn-quiet" onClick={() => setAsking(false)}>Cancel</button>
            </>
          ) : (
            <button type="button" className="adm-btn adm-btn-danger" disabled={busy} onClick={() => setAsking(true)}>Reject</button>
          )}
        </div>
      )}
      {error ? <p className="adm-field-error" role="alert">{error}</p> : null}
    </li>
  );
}
