"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, friendlyError, safeNext } from "@/lib/ui/api";
import { DEFAULT_LANDING, landingFor, type LandingPaths, type SignInRole } from "@/components/auth/landing";

export type { SignInRole } from "@/components/auth/landing";
export { landingFor, DEFAULT_LANDING } from "@/components/auth/landing";
type Step = "role" | "identifier" | "code";
type Channel = "phone" | "email";

export const SIGN_IN_EVENT = "tk:open-sign-in";
export const RESEND_SECONDS = 30;

/** Opens the sign-in sheet from anywhere on the page. "Log in" passes "user", "Post your ad" passes "seller". */
export function openSignIn(role: SignInRole = "user", next?: string | null) {
  window.dispatchEvent(new CustomEvent(SIGN_IN_EVENT, { detail: { role, next: next ?? null } }));
}

/** Keeps only digits, so a pasted code with spaces still works. */
export function digitsOnly(value: string, max: number) {
  return value.replace(/\D/g, "").slice(0, max);
}

/** Phone numbers stay as typed. Email is trimmed and lower-cased, as the server does. */
export function normalizeIdentifier(channel: Channel, raw: string) {
  return channel === "email" ? raw.trim().toLowerCase() : raw.trim();
}

const COPY: Record<Step, { title: string; help: string }> = {
  role: { title: "Log in or sign up", help: "Choose how you will use Tharkoo. No password, ever: we send you a one-time code." },
  identifier: { title: "Enter your email", help: "We will send a 6-digit code to this address. New here? The same step creates your account." },
  code: { title: "Enter your code", help: "The code is valid for 10 minutes. Check your inbox." },
};

interface Props {
  /** Test and fallback pages can render the sheet already open. */
  initiallyOpen?: boolean;
  /** Login page: shows the same content inline, without the overlay. */
  inline?: boolean;
  /** Login page: the role and return address from the URL. */
  initialRole?: SignInRole;
  initialNext?: string | null;
  /** Where each kind of person lands. The server passes the real paths. */
  landing?: LandingPaths;
  /** The mobile tab is shown only when an SMS gateway can deliver. Until then only email is offered. */
  showMobile?: boolean;
}

export function SignInSheet({ initiallyOpen = false, inline = false, initialRole = "user", initialNext = null, landing = DEFAULT_LANDING, showMobile = false }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(initiallyOpen || inline);
  const [role, setRole] = useState<SignInRole>(initialRole);
  const [next, setNext] = useState<string | null>(safeNext(initialNext));
  const [step, setStep] = useState<Step>("role");
  const [channel, setChannel] = useState<Channel>("email");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOpen(event: Event) {
      const detail = (event as CustomEvent<{ role?: SignInRole; next?: string | null }>).detail;
      setRole(detail?.role === "seller" ? "seller" : "user");
      setNext(safeNext(detail?.next ?? null));
      setStep("role");
      setMessage("");
      setOpen(true);
    }
    window.addEventListener(SIGN_IN_EVENT, onOpen);
    return () => window.removeEventListener(SIGN_IN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  useEffect(() => {
    if (!open || inline) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, inline]);

  useEffect(() => {
    if (open) dialogRef.current?.querySelector<HTMLElement>("input,button")?.focus();
  }, [open, step]);

  if (!open) return null;

  async function sendCode(resend = false) {
    setBusy(true);
    setMessage("");
    const value = normalizeIdentifier(channel, identifier);
    const path = channel === "phone" ? "/api/auth/otp/send" : "/api/auth/email/otp/send";
    const body = channel === "phone" ? { phone: value } : { email: value };
    const res = await api<{ sent: boolean }>(path, { method: "POST", body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) {
      setMessage(friendlyError(res.error));
      return;
    }
    setStep("code");
    setCode("");
    setResendIn(RESEND_SECONDS);
    setMessage(resend ? "A new code was sent." : "");
  }

  async function verifyCode() {
    setBusy(true);
    setMessage("");
    const value = normalizeIdentifier(channel, identifier);
    const path = channel === "phone" ? "/api/auth/otp/verify" : "/api/auth/email/otp/verify";
    const body = channel === "phone" ? { phone: value, code } : { email: value, code };
    const res = await api<{ user: { roles?: string[]; seller?: unknown | null } }>(path, { method: "POST", body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) {
      setMessage(res.status === 401 ? "That code is not valid. Check it, or ask for a new one." : friendlyError(res.error));
      return;
    }
    setOpen(false);
    router.push(
      landingFor({
        roles: res.data.user?.roles,
        hasSellerProfile: Boolean(res.data.user?.seller),
        role,
        next,
        paths: landing,
      }),
    );
    router.refresh();
  }

  const copy = COPY[step];
  // The login page has one h1; the overlay sits on a page that already has one.
  const TitleTag = inline ? "h1" : "h2";
  const roleLabel = role === "seller" ? "I am a seller" : "I am a user";

  const body = (
    <div ref={dialogRef} role={inline ? undefined : "dialog"} aria-modal={inline ? undefined : true} aria-labelledby="tk-si-title" className="tk-si">
      <style>{SHEET_CSS}</style>
      {!inline ? (
        <button type="button" className="tk-si-close" onClick={() => setOpen(false)} aria-label="Close">
          ×
        </button>
      ) : null}
      <TitleTag id="tk-si-title" className="tk-si-title">{copy.title}</TitleTag>
      <p className="tk-si-help">{copy.help}</p>

      {step === "role" ? (
        <div className="tk-si-form">
          <div role="radiogroup" aria-label="I am here to" className="tk-si-roles">
            {(["user", "seller"] as SignInRole[]).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={role === value}
                className={`tk-si-role ${role === value ? "is-on" : ""}`}
                onClick={() => setRole(value)}
              >
                {value === "user" ? "I am a user" : "I am a seller"}
              </button>
            ))}
          </div>
          <button type="button" className="tk-si-primary" onClick={() => setStep("identifier")}>
            Continue
          </button>
        </div>
      ) : null}

      {step === "identifier" ? (
        <form
          className="tk-si-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void sendCode();
          }}
        >
          {showMobile ? (
            <div role="tablist" aria-label="Send the code to" className="tk-si-roles">
              {(["email", "phone"] as Channel[]).map((value) => (
                <button key={value} type="button" role="tab" aria-selected={channel === value} className={`tk-si-role ${channel === value ? "is-on" : ""}`} onClick={() => setChannel(value)}>
                  {value === "phone" ? "Mobile (+91)" : "Email"}
                </button>
              ))}
            </div>
          ) : null}
          <label className="tk-si-label">
            <span>{channel === "phone" ? "Mobile number" : "Email address"}</span>
            <input
              className="tk-si-input"
              name={channel}
              type={channel === "phone" ? "tel" : "email"}
              inputMode={channel === "phone" ? "tel" : "email"}
              autoComplete={channel === "phone" ? "tel" : "email"}
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              required
            />
          </label>
          <button type="submit" className="tk-si-primary" disabled={busy || identifier.trim().length < 5}>
            {busy ? "Sending" : "Send code"}
          </button>
        </form>
      ) : null}

      {step === "code" ? (
        <form
          className="tk-si-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void verifyCode();
          }}
        >
          <label className="tk-si-label">
            <span>6-digit code</span>
            <input
              className="tk-si-input tk-si-code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(digitsOnly(event.target.value, 6))}
              required
            />
          </label>
          <button type="submit" className="tk-si-primary" disabled={busy || code.length !== 6}>
            {busy ? "Checking" : "Log in"}
          </button>
          <div className="tk-si-row">
            <button type="button" className="tk-si-link" disabled={busy || resendIn > 0} onClick={() => void sendCode(true)}>
              {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
            </button>
            <button type="button" className="tk-si-link" onClick={() => setStep("identifier")}>
              Use a different address
            </button>
          </div>
        </form>
      ) : null}

      <p aria-live="polite" className="tk-si-message">{message}</p>
      {step !== "role" ? (
        <p className="tk-si-help">{roleLabel}. <button type="button" className="tk-si-link" onClick={() => setStep("role")}>Change</button></p>
      ) : null}
    </div>
  );

  if (inline) return <section className="tk-si-inline" aria-label="Log in">{body}</section>;
  return (
    <div className="tk-si-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
      {body}
    </div>
  );
}

const SHEET_CSS = `
.tk-si-backdrop{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:rgba(17,5,32,.36);padding:16px}
.tk-si,.tk-si-inline{position:relative;box-sizing:border-box;width:100%;max-width:460px;max-height:90vh;overflow:auto;padding:32px 28px 28px;border-radius:20px;background:rgba(255,255,255,.92);border:1px solid #fff;box-shadow:0 24px 64px rgba(45,18,72,.22);backdrop-filter:blur(22px) saturate(180%);color:#1E0B38;font-family:'Plus Jakarta Sans',system-ui,sans-serif}
.tk-si-inline{margin:24px auto}
.tk-si-title{margin:0 0 6px;font-size:24px;letter-spacing:-.02em;color:#110520}
.tk-si-help{margin:0 0 12px;font-size:14px;line-height:1.55;color:#4A2870}
.tk-si-close{position:absolute;top:10px;right:10px;min-width:44px;min-height:44px;border:0;background:none;font-size:26px;color:#4A2870;cursor:pointer}
.tk-si-form{display:grid;gap:14px}
.tk-si-roles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.tk-si-role{min-height:48px;padding:0 12px;border-radius:14px;border:1.5px solid #EAD8F0;background:#fff;font:inherit;font-size:15px;font-weight:700;color:#4A2870;cursor:pointer}
.tk-si-role.is-on{border-color:#D1137A;background:linear-gradient(135deg,#FFE4F1,#F3E8FF);color:#A8124F}
.tk-si-label{display:grid;gap:8px;font-size:14px;font-weight:700}
.tk-si-input{width:100%;box-sizing:border-box;min-height:48px;border:1.5px solid #EAD8F0;border-radius:12px;padding:0 14px;font:inherit;font-size:16px;color:#1E0B38;background:#fff}
.tk-si-code{letter-spacing:.4em;text-align:center;font-size:20px}
.tk-si-input:focus-visible,.tk-si-role:focus-visible,.tk-si-primary:focus-visible,.tk-si-link:focus-visible,.tk-si-close:focus-visible{outline:3px solid #7C3AED;outline-offset:2px}
.tk-si-primary{min-height:48px;border:0;border-radius:999px;background:linear-gradient(135deg,#D1137A,#A8124F);color:#fff;font:inherit;font-size:15px;font-weight:700;cursor:pointer}
.tk-si-primary:disabled{opacity:.55;cursor:not-allowed}
.tk-si-link{min-height:44px;padding:0 4px;border:0;background:none;font:inherit;font-size:14px;font-weight:600;color:#A8124F;text-decoration:underline;cursor:pointer}
.tk-si-link:disabled{color:#8a7a99;cursor:default;text-decoration:none}
.tk-si-row{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px}
.tk-si-message{min-height:20px;margin:8px 0 0;font-size:14px;color:#A8124F}
@media (max-width:640px){.tk-si-backdrop{align-items:flex-end;padding:0}.tk-si{max-width:none;border-radius:20px 20px 0 0;padding:28px 20px calc(24px + env(safe-area-inset-bottom))}}
@media (prefers-reduced-motion:reduce){.tk-si *{transition:none !important;animation:none !important}}
`;
