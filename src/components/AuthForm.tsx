"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { api, fieldErrors, friendlyError, isStaffRole, safeNext } from "@/lib/ui/api";
import { Button } from "./ui/Button";
import { Checkbox, Field, Input } from "./ui/Input";

function strength(password: string) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

function AuthFormInner({ mode }: { mode: "login" | "register" | "forgot" | "reset" | "verify" | "expired" }) {
  const router = useRouter();
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
    setBusy(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    const res = await api<{ user: { roles?: string[] } }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: data.get("email"), password: data.get("password") }),
    });
    setBusy(false);
    if (!res.ok) return fail(res.error);
    const staff = isStaffRole(res.data.user?.roles);
    router.push(next || (staff ? "/admin/" : "/u/account/dashboard/"));
    router.refresh();
  }

  async function onRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
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
    setMessage("Account created. Check your inbox to confirm your email.");
  }

  async function onForgot(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const res = await api("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email: data.get("email") }),
    });
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
    const res = await api("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password: data.get("password") }),
    });
    setBusy(false);
    if (!res.ok) return fail(res.error);
    router.push("/u/login/");
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

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <form
        className="grid gap-4 rounded-xl border border-line bg-surface p-6"
        onSubmit={mode === "login" ? onLogin : mode === "register" ? onRegister : mode === "forgot" ? onForgot : mode === "reset" ? onReset : (event) => event.preventDefault()}
      >
        <h1 className="t-h1">
          {mode === "login" && "Log in"}
          {mode === "register" && "Create an account"}
          {mode === "forgot" && "Forgot password"}
          {mode === "reset" && "Choose a new password"}
          {mode === "verify" && "Confirm your email"}
          {mode === "expired" && "Password expired"}
        </h1>
        <div aria-live="polite" className="t-small text-gold">
          {message}
        </div>
        {mode === "verify" ? (
          <Button type="button" onClick={onVerify} loading={busy}>
            Confirm email
          </Button>
        ) : null}
        {mode === "expired" ? (
          <p className="t-body text-muted">
            Request a fresh link to set a new password. <Link href="/u/forgot/" className="text-gold">Forgot password</Link>
          </p>
        ) : null}
        {mode === "register" ? (
          <Field id="displayName" label="Name" error={fields.displayName?.[0]}>
            <Input id="displayName" name="displayName" autoComplete="name" required />
          </Field>
        ) : null}
        {mode === "login" || mode === "register" || mode === "forgot" ? (
          <Field id="email" label="Email" error={fields.email?.[0]}>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </Field>
        ) : null}
        {mode === "login" || mode === "register" || mode === "reset" ? (
          <Field id="password" label="Password" error={fields.password?.[0]} hint={mode === "register" ? "Use 8 or more characters, with mixed case, a number, or a symbol." : undefined}>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={show ? "text" : "password"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={mode === "login" ? 1 : 8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button type="button" className="absolute right-2 top-2 min-h-11 px-2 t-small" onClick={() => setShow((v) => !v)}>
                {show ? "Hide" : "Show"}
              </button>
            </div>
            {mode === "register" ? (
              <span className="mt-1 block h-1.5 overflow-hidden rounded-pill bg-surface-2" aria-hidden>
                <span className="block h-full bg-gold" style={{ width: `${(score / 5) * 100}%` }} />
              </span>
            ) : null}
          </Field>
        ) : null}
        {mode === "register" ? (
          <>
            <Field id="dateOfBirth" label="Date of birth" error={fields.dateOfBirth?.[0]}>
              <Input id="dateOfBirth" name="dateOfBirth" type="date" required />
            </Field>
            <Checkbox name="acceptedTerms" label="I agree to the terms and privacy policy" required />
            <Checkbox name="attestedAdult" label="I am 18 or over" required />
          </>
        ) : null}
        {mode !== "verify" && mode !== "expired" ? (
          <Button type="submit" loading={busy}>
            {mode === "login" ? "Log in" : mode === "register" ? "Create account" : mode === "forgot" ? "Send reset link" : "Save password"}
          </Button>
        ) : null}
        {mode === "login" ? (
          <p className="t-small">
            <Link href="/u/forgot/" className="text-gold">Forgot password</Link>
            {" · "}
            <Link href="/u/register/" className="text-gold">Register</Link>
          </p>
        ) : null}
        {mode === "register" ? (
          <p className="t-small">
            Already registered? <Link href="/u/login/" className="text-gold">Log in</Link>
          </p>
        ) : null}
      </form>
    </div>
  );
}

export function AuthForm({ mode }: { mode: "login" | "register" | "forgot" | "reset" | "verify" | "expired" }) {
  return (
    <Suspense fallback={<p className="p-8 t-body">Loading…</p>}>
      <AuthFormInner mode={mode} />
    </Suspense>
  );
}
