"use client";

import { useState } from "react";
import "./report.css";

const REASONS: [string, string][] = [
  ["prohibited_content", "Prohibited content"],
  ["trafficking_concern", "Concern about trafficking or exploitation"],
  ["stolen_media", "Photos taken from someone else"],
  ["spam", "Spam or repeated posting"],
  ["fake", "Fake or misleading ad"],
  ["duplicate", "Duplicate ad"],
  ["wrong_contact", "Wrong or dead contact details"],
  ["video", "A video on this ad"],
  ["other", "Something else"],
];

export function ReportForm({ ad }: { ad: string }) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ad) return setMessage({ kind: "error", text: "Open this page from an ad to report it." });
    if (!reason) return setMessage({ kind: "error", text: "Choose a reason." });
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/reports/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ad, reason, details }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && body.ok) {
        setSent(true);
        setMessage({ kind: "ok", text: "Thank you. Our team reviews every report." });
      } else {
        setMessage({ kind: "error", text: body.error || "Could not send the report. Please try again." });
      }
    } catch {
      setMessage({ kind: "error", text: "Could not send the report. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  if (sent) return <p role="status" className="rp-done">{message?.text}</p>;

  return (
    <form onSubmit={submit} className="rp-form" aria-label="Report this ad">
      <label className="rp-field">
        <span className="rp-label">Why are you reporting this ad? *</span>
        <select className="rp-input" value={reason} onChange={(event) => setReason(event.target.value)} required>
          <option value="">Choose a reason</option>
          {REASONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="rp-field">
        <span className="rp-label">More details (optional)</span>
        <textarea
          className="rp-input"
          rows={5}
          maxLength={1000}
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          placeholder="What is wrong with this ad? Up to 1000 characters."
        />
        <span className="rp-count">{details.length} / 1000</span>
      </label>
      {message ? (
        <p role={message.kind === "error" ? "alert" : "status"} className={message.kind === "error" ? "rp-message is-error" : "rp-message"}>
          {message.text}
        </p>
      ) : null}
      <div>
        <button type="submit" className="tk-btn tk-btn-cta" disabled={busy}>
          {busy ? "Sending…" : "Send report"}
        </button>
      </div>
    </form>
  );
}
