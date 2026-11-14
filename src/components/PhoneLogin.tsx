"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, friendlyError, isStaffRole } from "@/lib/ui/api";

const SENT = "If this number is linked to an account, a 6-digit code was sent. It is valid for 10 minutes.";

/** Phone sign-in: a code to a number already linked to an account. Email and password stay on the same screen above. */
export function PhoneLogin({ next }: { next: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function sendCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const res = await api<{ sent: boolean }>("/api/auth/otp/send", { method: "POST", body: JSON.stringify({ phone }) });
    setBusy(false);
    if (!res.ok) return setMessage(friendlyError(res.error));
    setStep("code");
    setMessage(SENT);
  }

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const res = await api<{ user: { roles?: string[] } }>("/api/auth/otp/verify", { method: "POST", body: JSON.stringify({ phone, code }) });
    setBusy(false);
    if (!res.ok) return setMessage(friendlyError(res.error));
    router.push(next || (isStaffRole(res.data.user?.roles) ? "/admin/" : "/u/account/dashboard/"));
    router.refresh();
  }

  if (!open) {
    return (
      <p className="t-small" style={{ textAlign: "center", marginTop: 16 }}>
        <button type="button" onClick={() => setOpen(true)} style={{ background: "none", border: 0, color: "var(--accent)", textDecoration: "underline", cursor: "pointer" }}>
          Log in with a code sent to my phone
        </button>
      </p>
    );
  }

  return (
    <section aria-label="Log in with phone" style={{ marginTop: 18, display: "grid", gap: 12, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
      {step === "phone" ? (
        <form onSubmit={sendCode} style={{ display: "grid", gap: 10 }} noValidate>
          <label className="tk-field">
            <span>Phone number</span>
            <input name="phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required />
          </label>
          <button className="tk-btn tk-btn-outline-primary" type="submit" disabled={busy || phone.trim().length < 8} style={{ width: "100%" }}>
            {busy ? "Sending" : "Send code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} style={{ display: "grid", gap: 10 }} noValidate>
          <label className="tk-field">
            <span>6-digit code</span>
            <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} required />
          </label>
          <button className="tk-btn tk-btn-gold" type="submit" disabled={busy || code.length !== 6} style={{ width: "100%" }}>
            {busy ? "Checking" : "LOG IN WITH CODE"}
          </button>
          <button type="button" onClick={() => setStep("phone")} style={{ background: "none", border: 0, color: "var(--accent)", cursor: "pointer" }}>
            Use a different number
          </button>
        </form>
      )}
      <div aria-live="polite" className="t-small" style={{ minHeight: 18, color: message === SENT ? "var(--muted)" : "var(--danger, #a12626)" }}>
        {message}
      </div>
    </section>
  );
}
