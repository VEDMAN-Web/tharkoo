"use client";

import { useState } from "react";
import { api, friendlyError } from "@/lib/ui/api";

/** Links a phone number to the signed-in account by a code. A linked number can then log in with a code (see PhoneLogin). */
export function PhoneLinkCard() {
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [linked, setLinked] = useState(false);

  async function start(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const res = await api<{ challengeId: string; dev?: boolean }>("/api/auth/phone/start", { method: "POST", body: JSON.stringify({ phone }) });
    setBusy(false);
    if (!res.ok) return setMessage(friendlyError(res.error));
    setChallengeId(res.data.challengeId);
    setMessage(res.data.dev ? "Test mode: the code is in the server log, not sent by SMS." : "A code was sent to that number.");
  }

  async function confirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challengeId) return;
    setBusy(true);
    setMessage("");
    const res = await api<{ phoneVerified: boolean }>("/api/auth/phone/confirm", { method: "POST", body: JSON.stringify({ challengeId, code }) });
    setBusy(false);
    if (!res.ok) return setMessage(friendlyError(res.error));
    setLinked(true);
    setChallengeId(null);
    setCode("");
    setMessage("Phone linked. You can now log in with a code sent to it.");
  }

  return (
    <section aria-label="Login phone" style={{ display: "grid", gap: 12, border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginTop: 20 }}>
      <h2 style={{ fontSize: 18, margin: 0 }}>Login phone</h2>
      <p className="t-small" style={{ color: "var(--muted)", margin: 0 }}>
        Link a number to log in with a code. {linked ? "Linked." : ""}
      </p>
      {challengeId ? (
        <form onSubmit={confirm} style={{ display: "grid", gap: 10 }} noValidate>
          <label className="tk-field">
            <span>Code</span>
            <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} required />
          </label>
          <button className="tk-btn tk-btn-gold" type="submit" disabled={busy || code.length !== 6}>
            {busy ? "Checking" : "Confirm number"}
          </button>
        </form>
      ) : (
        <form onSubmit={start} style={{ display: "grid", gap: 10 }} noValidate>
          <label className="tk-field">
            <span>Phone number</span>
            <input name="phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required />
          </label>
          <button className="tk-btn tk-btn-outline-primary" type="submit" disabled={busy || phone.trim().length < 8}>
            {busy ? "Sending" : "Send code"}
          </button>
        </form>
      )}
      <div aria-live="polite" className="t-small" style={{ minHeight: 18, color: "var(--muted)" }}>
        {message}
      </div>
    </section>
  );
}
