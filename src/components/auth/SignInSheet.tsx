"use client";

import { type FormEvent, type MouseEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CodeBoxes } from "@/components/auth/CodeBoxes";
import { SellerSetup, type SellerValues } from "@/components/auth/SellerSetup";
import { SIGN_IN_CSS } from "@/components/auth/sign-in-css";
import { CODE_LENGTH, formatCountdown, indiaPhone } from "@/components/auth/sign-in-input";
import { DEFAULT_LANDING, landingFor, type LandingPaths, type SignInRole } from "@/components/auth/landing";
import { useUrlPaths } from "@/components/UrlPaths";
import { api, fieldErrors, friendlyError, isStaffRole, safeNext } from "@/lib/ui/api";
import { applyPrefixes } from "@/lib/urls";
import { useFocusTrap } from "@/components/ui/useFocusTrap";

export type { SignInRole } from "@/components/auth/landing";
export { landingFor, DEFAULT_LANDING } from "@/components/auth/landing";

type Step = "identify" | "code" | "seller";
type Channel = "phone" | "email";

interface VerifiedUser {
  roles?: string[];
  seller?: unknown | null;
  dateOfBirth?: string | null;
}

export const SIGN_IN_EVENT = "tk:open-sign-in";
export const RESEND_SECONDS = 30;
export const SIGN_IN_HOST_ATTR = "data-signin-host";
const SIGN_IN_HINT = "tk-in";

export interface SignInEventDetail {
  role?: SignInRole;
  next?: string | null;
}

export function openSignIn(role: SignInRole = "user", next?: string | null): boolean {
  if (typeof document === "undefined" || !document.querySelector(`[${SIGN_IN_HOST_ATTR}]`)) return false;
  const detail: SignInEventDetail = { role, next: next ?? null };
  window.dispatchEvent(new CustomEvent<SignInEventDetail>(SIGN_IN_EVENT, { detail }));
  return true;
}

export function openSignInFromLink(event: MouseEvent<HTMLElement>, role: SignInRole = "user", next?: string) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (openSignIn(role, next)) event.preventDefault();
}

export function isProbablySignedIn(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((part) => part.trim().startsWith(`${SIGN_IN_HINT}=`));
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
  identify: { title: "Log in or sign up", help: "Enter your mobile number or email and we send you a 6-digit code. No password, ever." },
  code: { title: "Enter your code", help: "We sent a 6-digit code. It is valid for 10 minutes." },
  seller: { title: "Your seller profile", help: "This is what people see on your ads. You can change it any time." },
};

export interface SignInSheetProps {
  mode: "page" | "popup";
  initialRole?: SignInRole;
  initialNext?: string | null;
  /** Where each kind of person lands. The server passes the real paths. */
  landing?: LandingPaths;
  showMobile?: boolean;
  onClose?: () => void;
}

export function SignInSheet({ mode, initialRole = "user", initialNext = null, landing = DEFAULT_LANDING, showMobile = false, onClose }: SignInSheetProps) {
  const router = useRouter();
  const paths = useUrlPaths();
  const popup = mode === "popup";
  const [role, setRole] = useState<SignInRole>(initialRole);
  const [channel, setChannel] = useState<Channel>(showMobile ? "phone" : "email");
  const [identifier, setIdentifier] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [step, setStep] = useState<Step>("identify");
  const [code, setCode] = useState("");
  const [keepIn, setKeepIn] = useState(true);
  const [askDob, setAskDob] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [sellerErrors, setSellerErrors] = useState<Record<string, string[]>>({});
  const [resendIn, setResendIn] = useState(0);
  const rootRef = useFocusTrap<HTMLDivElement>(popup, () => onClose?.());
  const skipFirstFocus = useRef(true);
  const next = safeNext(initialNext);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  useEffect(() => {
    if (skipFirstFocus.current) {
      skipFirstFocus.current = false;
      if (!popup) return;
    }
    rootRef.current?.querySelector<HTMLElement>("[data-focus]")?.focus();
  }, [step, popup, rootRef]);

  const identifierReady = channel === "phone" ? identifier.replace(/\D/g, "").length >= 10 : identifier.trim().length >= 5;

  async function sendCode(resend = false) {
    const value = channel === "phone" ? indiaPhone(identifier) : normalizeIdentifier("email", identifier);
    setBusy(true);
    setMessage("");
    const res =
      channel === "phone"
        ? await api<{ sent: boolean }>("/api/auth/otp/send", { method: "POST", body: JSON.stringify({ phone: value }) })
        : await api<{ sent: boolean }>("/api/auth/email/otp/send", { method: "POST", body: JSON.stringify({ email: value }) });
    setBusy(false);
    if (!res.ok) {
      setMessage(friendlyError(res.error));
      return;
    }
    setSentTo(value);
    setStep("code");
    setCode("");
    setResendIn(RESEND_SECONDS);
    setMessage(resend ? "A new code was sent." : "");
  }

  async function verifyCode(value: string) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    const res =
      channel === "phone"
        ? await api<{ user: VerifiedUser }>("/api/auth/otp/verify", { method: "POST", body: JSON.stringify({ phone: sentTo, code: value, remember: keepIn }) })
        : await api<{ user: VerifiedUser }>("/api/auth/email/otp/verify", { method: "POST", body: JSON.stringify({ email: sentTo, code: value, remember: keepIn }) });
    setBusy(false);
    if (!res.ok) {
      setCode("");
      setMessage(res.status === 401 ? "That code is not valid. Check it, or ask for a new one." : friendlyError(res.error));
      rootRef.current?.querySelector<HTMLElement>("[data-focus]")?.focus();
      return;
    }
    const user = res.data.user;
    if (role === "seller" && !user.seller && !isStaffRole(user.roles)) {
      setAskDob(!user.dateOfBirth);
      setStep("seller");
      return;
    }
    finish(user.roles, Boolean(user.seller), false);
  }

  async function saveSeller(values: SellerValues) {
    setBusy(true);
    setMessage("");
    setSellerErrors({});
    const body = {
      name: values.name.trim(),
      city: values.city.trim(),
      whatsapp: "",
      availableNow: false,
      ...(askDob ? { dateOfBirth: values.dateOfBirth, adultConfirmed: values.adultConfirmed } : {}),
    };
    const res = await api<{ seller: unknown }>("/api/auth/seller-profile", { method: "PUT", body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) {
      setSellerErrors(fieldErrors(res.error));
      setMessage(friendlyError(res.error));
      return;
    }
    finish(undefined, true, true);
  }

  function finish(roles: string[] | undefined, hasSellerProfile: boolean, newSeller: boolean) {
    const current = window.location.pathname + window.location.search;
    const returnTo = popup ? (next ?? current) : (next ?? (newSeller ? landing.postAd : null));
    const destination = landingFor({ roles, hasSellerProfile, role, next: returnTo, paths: landing });
    if (popup) {
      onClose?.();
      if (destination !== current) router.push(destination);
    } else {
      router.push(destination);
    }
    router.refresh();
  }

  const copy = COPY[step];
  const Title = popup ? "h2" : "h1";
  const describedBy = message ? "tk-si-msg" : undefined;

  return (
    <div ref={rootRef} className={`tk-si ${popup ? "tk-si-popup" : "tk-si-page"}`} role={popup ? "dialog" : undefined} aria-modal={popup ? true : undefined} aria-labelledby="tk-si-title">
      <style>{SIGN_IN_CSS}</style>
      <div className="tk-si-card">
        <aside className="tk-si-side">
          <p className="tk-si-eyebrow">Tharkoo account</p>
          <h2 className="tk-si-pitch">One code. No password.</h2>
          <ul className="tk-si-points">
            <li className="tk-si-point"><span className="tk-si-num" aria-hidden="true">1</span><span className="tk-si-point-text">No password to remember</span></li>
            <li className="tk-si-point"><span className="tk-si-num" aria-hidden="true">2</span><span className="tk-si-point-text">Chat, save ads and get alerts</span></li>
            <li className="tk-si-point"><span className="tk-si-num" aria-hidden="true">3</span><span className="tk-si-point-text">Post your own ads for free</span></li>
          </ul>
        </aside>

        <section className="tk-si-main">
          {popup ? (
            <button type="button" className="tk-si-close tk-si-focus" aria-label="Close" onClick={() => onClose?.()}>
              ×
            </button>
          ) : null}
          <div>
            <Title id="tk-si-title" className="tk-si-title">{copy.title}</Title>
            <p className="tk-si-help">{step === "code" ? `We sent a 6-digit code to ${sentTo}. It is valid for 10 minutes.` : copy.help}</p>
          </div>

          {step === "identify" ? (
            <form
              className="tk-si-stack"
              noValidate
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                if (busy) return;
                if (!identifierReady) {
                  setMessage(channel === "phone" ? "Enter your 10-digit mobile number." : "Enter your email address.");
                  return;
                }
                void sendCode();
              }}
            >
              <div role="radiogroup" aria-label="I am here to" className="tk-si-roles">
                {(["user", "seller"] as SignInRole[]).map((value) => (
                  <button key={value} type="button" role="radio" aria-checked={role === value} className={`tk-si-role tk-si-focus ${role === value ? "is-on" : ""}`} onClick={() => setRole(value)}>
                    <span className="tk-si-role-name">{value === "user" ? "I am a user" : "I am a seller"}</span>
                    <span className="tk-si-role-sub">{value === "user" ? "Browse, save and chat" : "Post ads and get calls"}</span>
                  </button>
                ))}
              </div>

              <div role="tablist" aria-label="Send the code by" className="tk-si-tabs">
                <button type="button" role="tab" aria-selected={channel === "phone"} disabled={!showMobile} className="tk-si-tab tk-si-focus" onClick={() => setChannel("phone")}>
                  Mobile number
                </button>
                <button type="button" role="tab" aria-selected={channel === "email"} className="tk-si-tab tk-si-focus" onClick={() => setChannel("email")}>
                  Email
                </button>
              </div>
              {!showMobile ? <p className="tk-si-soon">Text message codes are coming soon. Use email for now.</p> : null}

              {channel === "phone" ? (
                <div>
                  <label className="tk-si-lab" htmlFor="tk-si-phone">Mobile number</label>
                  <div className="tk-si-phone">
                    <span className="tk-si-prefix">+91</span>
                    <input id="tk-si-phone" data-focus="" className="tk-si-in tk-si-focus" name="phone" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="98250 12345" value={identifier} onChange={(event) => setIdentifier(event.target.value)} aria-describedby={describedBy} />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="tk-si-lab" htmlFor="tk-si-email">Email address</label>
                  <input id="tk-si-email" data-focus="" className="tk-si-in tk-si-focus" name="email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={identifier} onChange={(event) => setIdentifier(event.target.value)} aria-describedby={describedBy} />
                </div>
              )}

              <label className="tk-si-check">
                <input type="checkbox" checked={keepIn} onChange={(event) => setKeepIn(event.target.checked)} />
                Keep me logged in on this device
              </label>
              <button type="submit" className="tk-si-primary tk-si-focus" disabled={busy}>
                {busy ? "Sending" : "Send me a code"}
              </button>
              <p className="tk-si-terms">
                By continuing you agree to the <a href={applyPrefixes("/terms/", paths)}>Terms</a> and <a href={applyPrefixes("/privacy/", paths)}>Privacy Policy</a>.
              </p>
            </form>
          ) : null}

          {step === "code" ? (
            <form
              className="tk-si-stack"
              noValidate
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                if (code.length === CODE_LENGTH) void verifyCode(code);
              }}
            >
              <CodeBoxes
                value={code}
                disabled={busy}
                invalid={Boolean(message)}
                describedBy={describedBy}
                onChange={(next) => {
                  setCode(next);
                  if (next.length === CODE_LENGTH) void verifyCode(next);
                }}
              />
              <button type="submit" className="tk-si-primary tk-si-focus" disabled={busy || code.length !== CODE_LENGTH}>
                {busy ? "Checking" : "Log in"}
              </button>
              <div className="tk-si-row">
                <button type="button" className="tk-si-link tk-si-focus" disabled={busy || resendIn > 0} onClick={() => void sendCode(true)}>
                  {resendIn > 0 ? `Resend in ${formatCountdown(resendIn)}` : "Resend code"}
                </button>
                <button
                  type="button"
                  className="tk-si-link tk-si-focus"
                  onClick={() => {
                    setStep("identify");
                    setCode("");
                    setMessage("");
                  }}
                >
                  Use a different address
                </button>
              </div>
            </form>
          ) : null}

          {step === "seller" ? <SellerSetup askDateOfBirth={askDob} busy={busy} errors={sellerErrors} onSubmit={(values) => void saveSeller(values)} /> : null}

          <p id="tk-si-msg" className="tk-si-error" aria-live="polite">{message}</p>
        </section>
      </div>
    </div>
  );
}
