"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { api, fieldErrors, type ApiError, friendlyError, isStaffRole, safeNext } from "@/lib/ui/api";
import { loginPath, registerPath } from "@/lib/urls";
import { useUrlPaths } from "./UrlPaths";
import { PhoneLogin } from "./PhoneLogin";

type Mode = "login" | "register" | "forgot" | "reset" | "verify" | "expired";

function strength(password: string) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

/** Message shown when the login API answers 429. N comes from retry-after, rounded up to whole minutes. */
export function tooManyAttemptsMessage(retryAfter: string | null) {
  const seconds = Number(retryAfter);
  const minutes = Math.max(1, Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds / 60) : 15);
  return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

/** Login call that keeps the retry-after header, which the shared api helper drops. */
export async function loginRequest(email: unknown, password: unknown) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "same-origin",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json().catch(() => null)) as { ok?: boolean; data?: { user: { roles?: string[] } }; error?: ApiError } | null;
  if (res.status === 429) {
    return { ok: false as const, status: 429, error: { code: "RATE_LIMITED", message: tooManyAttemptsMessage(res.headers.get("retry-after")) } as ApiError };
  }
  if (body && body.ok && body.data) return { ok: true as const, status: res.status, data: body.data };
  return { ok: false as const, status: res.status, error: (body?.error || { code: "ERROR", message: "Something went wrong. Please try again." }) as ApiError };
}

function AuthFormInner({ mode }: { mode: Mode }) {
  const router = useRouter();
  const paths = useUrlPaths();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const token = params.get("token") || "";
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [password, setPassword] = useState("");
  const score = useMemo(() => strength(password), [password]);

  function fail(error: { code?: string; message?: string; fields?: Record<string, string[]>; details?: Record<string, string[]> }) {
    setFields(fieldErrors(error));
    setMessage(friendlyError(error));
  }

  async function onLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const data = new FormData(event.currentTarget);
    if (!String(data.get("email") || "").trim() || !String(data.get("password") || "")) {
      setMessage("Please fill in your email and password.");
      return;
    }
    setBusy(true);
    const res = await loginRequest(data.get("email"), data.get("password"));
    setBusy(false);
    if (!res.ok) {
      if (res.status === 429) return setMessage(res.error.message || "");
      return fail(res.error);
    }
    router.push(next || (isStaffRole(res.data.user?.roles) ? "/admin/" : "/u/account/dashboard/"));
    router.refresh();
  }

  async function onRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const data = new FormData(event.currentTarget);
    if (!String(data.get("email") || "").trim() || !String(data.get("displayName") || "").trim() || String(data.get("password") || "").length < 8 || !data.get("dateOfBirth") || data.get("acceptedTerms") !== "on" || data.get("attestedAdult") !== "on") {
      setMessage("Please fill in every required field before creating an account.");
      return;
    }
    setBusy(true);
    const res = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        displayName: data.get("displayName"),
        email: data.get("email"),
        password: data.get("password"),
        dateOfBirth: data.get("dateOfBirth"),
        acceptedTerms: data.get("acceptedTerms") === "on",
        attestedAdult: data.get("attestedAdult") === "on",
      }),
    });
    setBusy(false);
    if (!res.ok) return fail(res.error);
    const login = await api<{ user: { roles?: string[] } }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: data.get("email"), password: data.get("password") }),
    });
    if (!login.ok) {
      setMessage("Account created. Check your inbox to confirm your email.");
      return;
    }
    router.push(next || "/u/account/dashboard/");
    router.refresh();
  }

  async function onForgot(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const res = await api("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: data.get("email") }) });
    setBusy(false);
    if (!res.ok) return fail(res.error);
    setMessage("If that email is registered, a reset link is on its way.");
  }

  async function onReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (token.length < 16) {
      setMessage("This reset link is missing a token. Request a new one.");
      return;
    }
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const res = await api("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password: data.get("password") }) });
    setBusy(false);
    if (!res.ok) return fail(res.error);
    router.push(loginPath(paths));
  }

  async function onVerify() {
    if (token.length < 16) {
      setMessage("Open the link from your email to confirm the address.");
      return;
    }
    setBusy(true);
    const res = await api("/api/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) });
    setBusy(false);
    if (!res.ok) return fail(res.error);
    setMessage("Email confirmed. You can log in.");
  }

  const withNext = (path: string) => (next ? `${path}?next=${encodeURIComponent(next)}` : path);
  const title =
    mode === "login" ? "Log in" : mode === "register" ? "Create your account" : mode === "forgot" ? "Reset your password" : mode === "reset" ? "Choose a new password" : mode === "verify" ? "Confirm your email" : "Password expired";

  return (
    <div className="tk-auth">
      <h1 className="tk-page-h1">{title}</h1>
      <form
        onSubmit={mode === "login" ? onLogin : mode === "register" ? onRegister : mode === "forgot" ? onForgot : mode === "reset" ? onReset : (event) => event.preventDefault()}
        noValidate
      >
        <div aria-live="polite" className="t-small" style={{ color: "var(--danger)", minHeight: 20 }}>{message}</div>
        {mode === "verify" ? (
          <button type="button" className="tk-btn tk-btn-gold" disabled={busy} onClick={onVerify} style={{ width: "100%" }}>
            Confirm email
          </button>
        ) : null}
        {mode === "expired" ? (
          <p className="t-small">
            Request a fresh link to set a new password. <Link href="/u/forgot/" style={{ color: "var(--accent)" }}>Forgot password</Link>
          </p>
        ) : null}
        {mode === "register" ? (
          <label className={`tk-field ${fields.displayName ? "is-bad" : ""}`}>
            <span>Name</span>
            <input id="displayName" name="displayName" autoComplete="name" required />
            {fields.displayName ? <span className="tk-error" data-tk="field-error">{fields.displayName[0]}</span> : null}
          </label>
        ) : null}
        {mode === "login" || mode === "register" || mode === "forgot" ? (
          <label className={`tk-field ${fields.email ? "is-bad" : ""}`}>
            <span>Email</span>
            <input id="email" name="email" type="email" autoComplete="email" required />
            {fields.email ? <span className="tk-error" data-tk="field-error">{fields.email[0]}</span> : null}
          </label>
        ) : null}
        {mode === "login" || mode === "register" || mode === "reset" ? (
          <label className={`tk-field ${fields.password ? "is-bad" : ""}`}>
            <span>Password</span>
            <span style={{ position: "relative", display: "block" }}>
              <input
                id="password"
                name="password"
                type={show ? "text" : "password"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={mode === "login" ? 1 : 8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                style={{ paddingRight: 64 }}
              />
              <button type="button" onClick={() => setShow((value) => !value)} style={{ position: "absolute", right: 8, top: 8, background: "none", border: 0, color: "var(--accent)", fontSize: 12 }}>
                {show ? "Hide" : "Show"}
              </button>
            </span>
            {mode === "register" ? (
              <span className="mt-2 flex gap-1" aria-hidden>
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} className="h-1 flex-1 rounded" style={{ background: i < score ? "var(--ok)" : "var(--bg-soft)" }} />
                ))}
              </span>
            ) : null}
            {fields.password ? <span className="tk-error" data-tk="field-error">{fields.password[0]}</span> : null}
          </label>
        ) : null}
        {mode === "register" ? (
          <>
            <label className={`tk-field ${fields.dateOfBirth ? "is-bad" : ""}`}>
              <span>Date of birth</span>
              <input id="dateOfBirth" name="dateOfBirth" type="date" required />
              {fields.dateOfBirth ? <span className="tk-error" data-tk="field-error">{fields.dateOfBirth[0]}</span> : null}
            </label>
            <div className="tk-checks">
              <label className="tk-checkrow">
                <input type="checkbox" name="acceptedTerms" required />
                <span>I agree to the <Link href="/terms/">Terms</Link> and <Link href="/privacy/">Privacy Policy</Link></span>
              </label>
              <label className="tk-checkrow">
                <input type="checkbox" name="attestedAdult" required />
                <span>I am 18 or over</span>
              </label>
            </div>
          </>
        ) : null}
        {mode !== "verify" && mode !== "expired" ? (
          <button className="tk-btn tk-btn-gold" type="submit" disabled={busy} style={{ width: "100%", marginTop: 8 }}>
            {busy ? "…" : mode === "login" ? "LOG IN" : mode === "register" ? "CREATE ACCOUNT" : mode === "forgot" ? "SEND LINK" : "SAVE PASSWORD"}
          </button>
        ) : null}
      </form>
      {mode === "login" ? (
        <p className="t-small" style={{ textAlign: "center", marginTop: 12 }}>
          <Link href={withNext("/u/forgot/")} style={{ color: "var(--accent)" }}>Forgot password?</Link>
          {" · "}
          <Link href={withNext(registerPath(paths))} style={{ color: "var(--accent)" }}>Create account</Link>
        </p>
      ) : null}
      {mode === "login" ? <PhoneLogin next={next} /> : null}
      {mode === "register" ? (
        <p className="t-small" style={{ textAlign: "center" }}>
          Already registered? <Link href={withNext(loginPath(paths))} style={{ color: "var(--accent)" }}>Log in</Link>
        </p>
      ) : null}
    </div>
  );
}

export function AuthForm({ mode }: { mode: Mode }) {
  return (
    <Suspense fallback={<p className="tk-container">Loading…</p>}>
      <AuthFormInner mode={mode} />
    </Suspense>
  );
}
