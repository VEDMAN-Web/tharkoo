"use client";

import Link from "next/link";
import { useState } from "react";
import { MailCheck, Trash2 } from "lucide-react";
import { api, friendlyError } from "@/lib/ui/api";
import { EmptyIcon } from "./UserPanelShell";

type Stage = "ask" | "sure" | "sent";

const REQUEST_TEXT = "Please delete my account and take my ads down. I understand this is permanent, that credits left in my wallet are lost, and that you may keep past payment records as the law asks.";

export function DeleteFlow() {
  const [stage, setStage] = useState<Stage>("ask");
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ticket, setTicket] = useState<number | null>(null);

  async function send() {
    setBusy(true);
    setError("");
    const res = await api<{ number: number }>("/api/support/tickets", {
      method: "POST",
      body: JSON.stringify({ topic: "my_account", subject: "Delete my account", body: REQUEST_TEXT }),
    });
    setBusy(false);
    if (!res.ok) return setError(friendlyError(res.error));
    setTicket(res.data.number);
    setStage("sent");
  }

  if (stage === "sent") {
    return (
      <section aria-labelledby="delete-title" className="up-glass up-panel up-empty" data-tk="delete-sent">
        <EmptyIcon icon={MailCheck} />
        <h1 id="delete-title" className="up-empty-title">Request received</h1>
        <p className="up-empty-body">
          Your request{ticket ? ` (ticket ${ticket})` : ""} is with our team. Nothing has been deleted yet. We will write to you on your support ticket to confirm before anything is removed.
        </p>
        <Link href="/u/account/support/" className="up-btn">See my ticket</Link>
      </section>
    );
  }

  return (
    <section aria-labelledby="delete-title" className="up-glass up-panel up-stack" data-tk="delete-account" data-stage={stage}>
      <EmptyIcon icon={Trash2} />
      <h1 id="delete-title" className="up-h2">{stage === "ask" ? "Delete your account" : "Send the request?"}</h1>
      {stage === "ask" ? (
        <>
          <p className="up-empty-body">Deleting your account is permanent. Our team does it for you after you ask, so no account is removed by mistake.</p>
          <ul className="up-list">
            <li>Your ads are taken down and your profile is removed.</li>
            <li>Credits left in your wallet are lost, so use them first.</li>
            <li>Past payments stay in our records, as the law asks.</li>
          </ul>
          <label className="up-check">
            <input type="checkbox" checked={understood} onChange={(event) => setUnderstood(event.target.checked)} data-tk="delete-understood" />
            <span>I understand this cannot be undone.</span>
          </label>
          <div className="up-actions">
            <button type="button" className="up-btn" data-tk="delete-request" disabled={!understood} onClick={() => setStage("sure")}>Request deletion</button>
            <Link href="/u/account/edit-account/" className="up-btn-ghost">Keep my account</Link>
          </div>
        </>
      ) : (
        <>
          <p className="up-empty-body">We will open a support ticket asking our team to delete your account. Nothing is deleted until they confirm with you.</p>
          {error ? <p className="up-note" role="alert" data-tk="delete-error">{error}</p> : null}
          <div className="up-actions">
            <button type="button" className="up-btn" data-tk="delete-confirm" disabled={busy} onClick={() => void send()}>{busy ? "Sending..." : "Yes, send the request"}</button>
            <button type="button" className="up-btn-ghost" disabled={busy} onClick={() => setStage("ask")}>Go back</button>
          </div>
        </>
      )}
    </section>
  );
}
