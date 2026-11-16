"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { friendlyError } from "@/lib/ui/api";
import { loginRequest } from "@/components/AuthForm";

export function AdminLoginForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    const res = await loginRequest(data.get("email"), data.get("password"));
    setBusy(false);
    if (!res.ok) {
      setMessage(res.status === 429 ? res.error.message || "" : friendlyError(res.error));
      return;
    }
    router.push("/admin/");
    router.refresh();
  }

  return (
    <div className="adm adm-login">
      <main className="adm-login-card">
        <div className="adm-login-brand">
          <img className="adm-brand-img" src="/brand/logo-mark-512.png" alt="" width={36} height={36} />
          <span>Tharkoo staff</span>
        </div>
        <form onSubmit={onSubmit} className="adm-login-form" aria-labelledby="adm-login-title">
          <h1 id="adm-login-title" className="adm-login-title">Staff sign in</h1>
          <p className="adm-login-lead">Use the email and password for your staff account.</p>
          <p className="adm-login-error" role="alert" aria-live="assertive" data-tk="login-error">{message}</p>
          <label className="adm-field" htmlFor="email">
            <span className="adm-field-label">Email</span>
            <input className="adm-input" id="email" name="email" type="email" autoComplete="username" required />
          </label>
          <label className="adm-field" htmlFor="password">
            <span className="adm-field-label">Password</span>
            <input className="adm-input" id="password" name="password" type="password" autoComplete="current-password" required />
          </label>
          <button type="submit" className="adm-btn adm-login-submit" disabled={busy} aria-busy={busy}>
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </main>
    </div>
  );
}
