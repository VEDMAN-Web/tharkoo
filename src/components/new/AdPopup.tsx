"use client";

import { trackEvent } from "@/lib/analytics/ga";
import { CallPacks } from "@/components/recharge/CallPacks";
import "@/components/recharge/call-popup.css";
import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { api, friendlyError } from "@/lib/ui/api";
import { useSellerStatus, type SellerStatus } from "@/components/availability/sellerStatus";
import { useFocusTrap } from "@/components/ui/useFocusTrap";
import { useT } from "@/components/ui/AdCard";
import { bgPhotoStyle } from "@/components/ui/card-photo";
import "@/components/ui/card-photo.css";
import { CallingStep } from "@/components/new/CallingStep";
import { SESSION_EVENT } from "@/components/account/AccountContext";
import { AvatarContent } from "@/components/ui/AvatarContent";

const noop = () => undefined;


export type PopupKind = "call" | "chat";
export type FlowResult = "ok" | "auth" | "coins" | "error";
export type AdPopupAlt = { slug: string; href: string; title: string; place: string; photo?: string | null };

type Step = "login" | "code" | "call" | "away" | "buy" | "calling" | "error";
type Channel = "phone" | "email";

export type AdPopupProps = {
  /** The advertiser's profile photo, when they added one. */
  photo?: string | null;
  kind: PopupKind;
  name: string;
  signedIn: boolean;
  seller?: SellerStatus;
  tourCoins: number | null;
  paymentsLive: boolean;
  alternatives: AdPopupAlt[];
  notice: string | null;
  /** H19.3: call credits just added by a payment that returned to this ad page: the pop-up says so. */
  paidAdded?: number | null;
  /** The video call request this pop-up started (or found already open): the calling step follows it. */
  tourId?: string | null;
  /** The visitor already has an open request on this ad: the pop-up opens on it instead of offering a new one. */
  openRequest?: boolean;
  /** The request closed (declined, ran out of time, or cancelled) and the credit is back. */
  onCallEnded?: () => void;
  onClose: () => void;
  onSignedIn: () => void;
  onStartCall: () => Promise<FlowResult>;
  onStartChat: () => Promise<FlowResult>;
  onSwitchToChat: () => void;
};

function firstStep(props: Pick<AdPopupProps, "kind" | "signedIn" | "seller" | "openRequest">): Step {
  if (props.kind === "chat" || !props.signedIn) return "login";
  if (props.openRequest) return "calling";
  return props.seller?.status === "away" ? "away" : "call";
}

export function AdPopup(props: AdPopupProps) {
  const t = useT();
  const { kind, name, seller, onClose } = props;
  const ref = useFocusTrap<HTMLDivElement>(true, onClose);
  const [step, setStep] = useState<Step>(() => firstStep(props));
  const [contact, setContact] = useState({ channel: "phone" as Channel, value: "" });
  const [busy, setBusy] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (step !== "call" && step !== "buy") return;
    let live = true;
    // H18.8: video calls are paid from call credits.
    void api<{ callBalance?: number }>("/api/wallet/").then((res) => {
      if (live && res.ok) setBalance(Number(res.data.callBalance) || 0);
    });
    return () => {
      live = false;
    };
  }, [step]);

  async function afterLogin() {
    // Signing in here does not reload the page: tell the header (and the balances) that someone is signed in now.
    window.dispatchEvent(new Event(SESSION_EVENT));
    props.onSignedIn();
    if (kind === "chat") {
      const result = await props.onStartChat();
      if (result === "ok") return onClose();
      return setStep("error");
    }
    setStep(seller?.status === "away" ? "away" : "call");
  }

  async function startCall() {
    setBusy(true);
    const result = await props.onStartCall();
    setBusy(false);
    if (result === "ok") return setStep("calling");
    if (result === "auth") return setStep("login");
    if (result === "coins") return setStep("buy");
    setStep("error");
  }

  const coins = props.tourCoins ?? 1;
  const coinUnit = coins === 1 ? t("ad.call.coinOne") : t("ad.call.coinMany", { count: coins });
  const title = titleFor(step, name, t);
  const help = helpFor(step, { kind, name, coins, coinText: coinUnit, contact: contact.value, t });
  const returnTo = typeof window === "undefined" ? "" : `${window.location.pathname}?call=1`;
  const short = balance !== null && balance < coins;

  return (
    <div
      className="tkn-pop-wrap"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div ref={ref} className="tkn-adpop" role="dialog" aria-modal="true" aria-labelledby="tkn-pop-title" data-tk="ad-popup" data-step={step}>
        <div className="tkn-pop-head">
          <h2 id="tkn-pop-title">{title}</h2>
          <button type="button" className="tkn-pop-x" aria-label={t("ad.popup.close")} onClick={onClose}>
            <X size={16} aria-hidden />
          </button>
        </div>
        <div className="tkn-pop-body">
          {help ? <p className="tkn-pop-help">{help}</p> : null}

          {step === "login" && kind === "call" ? <p role="status" className="tkn-pop-note">{t("ad.call.signIn")}</p> : null}

          {step === "login" ? (
            <LoginStep
              t={t}
              onSent={(sent) => {
                setContact(sent);
                setStep("code");
              }}
            />
          ) : null}

          {step === "code" ? <CodeStep t={t} channel={contact.channel} contact={contact.value} onVerified={() => void afterLogin()} onChangeContact={() => setStep("login")} /> : null}

          {step === "call" ? (
            <div className="tkn-pop-stack">
              <SellerRow name={name} photo={props.photo} status={seller?.status} t={t} />
              {props.paidAdded ? <p role="status" className="tkn-call-paid" data-tk="call-paid">{t("ad.call.paid", { count: props.paidAdded })}</p> : null}
              <ul className="tkn-call-benefits">
                <li>{t("ad.call.benefit1")}</li>
                <li>{t("ad.call.benefit2")}</li>
                <li>{t("ad.call.benefit3")}</li>
              </ul>
              <div className="tkn-call-facts">
                <span data-tk="call-price">{t("ad.call.priceLine", { coins: coinUnit })}</span>
                <span>
                  {t("ad.call.balance")}: <strong data-tk="call-balance">{balance === null ? "\u2026" : balance}</strong>
                </span>
              </div>
              {props.notice ? <p role="status" className="tkn-pop-note">{props.notice}</p> : null}
              <button type="button" className="tkn-pop-btn" data-tk="call-main" disabled={busy} onClick={() => (short ? setStep("buy") : void startCall())}>
                {short ? t("ad.call.buy") : t("ad.call.go")}
              </button>
              <button type="button" className="tkn-pop-link" onClick={props.onSwitchToChat}>
                {t("ad.call.chatFirst", { name })}
              </button>
            </div>
          ) : null}

          {step === "away" ? (
            <div className="tkn-pop-stack">
              <SellerRow name={name} photo={props.photo} status="away" t={t} />
              <p className="tkn-pop-sub">{t("ad.away.chatHelp", { name })}</p>
              <button type="button" className="tkn-pop-btn" data-tk="away-chat" onClick={props.onSwitchToChat}>
                {t("ad.away.chat", { name })}
              </button>
              <p className="tkn-pop-sub">{t("ad.away.alts")}</p>
              <div className="tkn-alts">
                {props.alternatives.map((alt) => (
                  <AltRow key={alt.slug || alt.href} alt={alt} t={t} />
                ))}
              </div>
            </div>
          ) : null}

          {step === "buy" ? (
            <div className="tkn-pop-stack">
              <CallPacks shortfall={Math.max(1, coins - (balance ?? 0))} returnTo={returnTo} />
              <p className="tkn-pop-sub">{t(coins === 1 ? "ad.buy.noteOne" : "ad.buy.noteMany")}</p>
            </div>
          ) : null}

          {step === "calling" ? <CallingStep tourId={props.tourId ?? null} name={name} t={t} onClose={onClose} onEnded={props.onCallEnded ?? noop} /> : null}

          {step === "error" ? (
            <div className="tkn-pop-stack">
              <p role="status" className="tkn-pop-note">{props.notice || t("ad.popup.error")}</p>
              <button type="button" className="tkn-pop-btn-line" onClick={onClose}>
                {t("ad.popup.close")}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type T = ReturnType<typeof useT>;

function titleFor(step: Step, name: string, t: T) {
  switch (step) {
    case "login":
      return t("ad.login.title");
    case "code":
      return t("ad.code.title");
    case "call":
      return t("ad.call.title");
    case "away":
      return t("ad.away.title", { name });
    case "buy":
      return t("ad.buy.title");
    case "calling":
      return t("ad.calling.title", { name });
    default:
      return t("ad.popup.error");
  }
}

function helpFor(step: Step, v: { kind: PopupKind; name: string; coins: number; coinText: string; contact: string; t: T }) {
  const { t } = v;
  switch (step) {
    case "login":
      return v.kind === "chat" ? t("ad.chat.signIn", { name: v.name }) : t("ad.login.help");
    case "code":
      return t("ad.code.help", { contact: v.contact });
    case "call":
      return "";
    case "away":
      return t("ad.away.help");
    case "buy":
      return t("ad.buy.help", { coins: v.coinText });
    case "calling":
      return t("ad.calling.help", { name: v.name });
    default:
      return "";
  }
}

function SellerRow({ name, photo, status, t }: { name: string; photo?: string | null; status?: "online" | "away"; t: T }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const away = status === "away";
  return (
    <div className={`tkn-pop-seller${away ? " is-away" : ""}`}>
      <span className="tkn-pop-avatar" aria-hidden><AvatarContent src={photo} fallback={initial} /></span>
      <span>
        <strong>{name}</strong>
        {status ? (
          <span className="tkn-pop-status" data-status={status}>
            {away ? t("ad.seller.away") : t("ad.seller.online")}
          </span>
        ) : null}
      </span>
    </div>
  );
}

function AltRow({ alt, t }: { alt: AdPopupAlt; t: T }) {
  const status = useSellerStatus(alt.slug);
  if (status?.status !== "online") return null;
  return (
    <a className="tkn-alt" href={alt.href}>
      {alt.photo ? <span className="tkn-alt-photo tk-bgphoto" style={bgPhotoStyle(alt.photo)}><img src={alt.photo} alt="" width={52} height={52} loading="lazy" /></span> : <span className="tkn-alt-photo" aria-hidden />}
      <span className="tkn-alt-text">
        <strong>{alt.title}</strong>
        <span>{t("ad.away.online", { place: alt.place })}</span>
      </span>
    </a>
  );
}

function LoginStep({ t, onSent }: { t: T; onSent: (sent: { channel: Channel; value: string }) => void }) {
  const [channel, setChannel] = useState<Channel>("phone");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const digits = value.replace(/\D/g, "");
    if (channel === "phone" && digits.length !== 10) return setError(t("ad.login.phoneError"));
    if (channel === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return setError(t("ad.login.emailError"));
    const sent = channel === "phone" ? { channel, value: `+91${digits}` } : { channel, value: value.trim() };
    setBusy(true);
    const res = await api<{ sent: boolean }>(channel === "phone" ? "/api/auth/otp/send" : "/api/auth/email/otp/send", {
      method: "POST",
      body: JSON.stringify(channel === "phone" ? { phone: sent.value } : { email: sent.value }),
    });
    setBusy(false);
    if (!res.ok) return setError(friendlyError(res.error));
    onSent(sent);
  }

  return (
    <form className="tkn-pop-stack" onSubmit={(event) => void send(event)} noValidate>
      {channel === "phone" ? (
        <div className="tkn-field-row">
          <span className="tkn-prefix" aria-hidden>+91</span>
          <label className="tkn-field-grow">
            <span className="sr-only">{t("ad.login.phone")}</span>
            <input className="tkn-input" type="tel" inputMode="tel" autoComplete="tel-national" placeholder={t("ad.login.phone")} value={value} onChange={(event) => setValue(event.target.value)} />
          </label>
        </div>
      ) : (
        <label className="tkn-field-grow">
          <span className="sr-only">{t("ad.login.email")}</span>
          <input className="tkn-input" type="email" autoComplete="email" placeholder={t("ad.login.email")} value={value} onChange={(event) => setValue(event.target.value)} />
        </label>
      )}
      {error ? <p role="alert" className="tkn-pop-note">{error}</p> : null}
      <button type="button" className="tkn-pop-link" onClick={() => setChannel(channel === "phone" ? "email" : "phone")}>
        {channel === "phone" ? t("ad.login.useEmail") : t("ad.login.usePhone")}
      </button>
      <button type="submit" className="tkn-pop-btn" disabled={busy}>
        {t("ad.login.send")}
      </button>
    </form>
  );
}

const CODE_LENGTH = 6;

function CodeStep({
  t,
  channel,
  contact,
  onVerified,
  onChangeContact,
}: {
  t: T;
  channel: Channel;
  contact: string;
  onVerified: () => void;
  onChangeContact: () => void;
}) {
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  function setDigit(index: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1);
    setDigits((prev) => prev.map((old, i) => (i === index ? digit : old)));
    if (digit && index < CODE_LENGTH - 1) inputs.current[index + 1]?.focus();
  }

  function onKey(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) inputs.current[index - 1]?.focus();
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    event.preventDefault();
    setDigits(Array.from({ length: CODE_LENGTH }, (_, i) => pasted[i] ?? ""));
    inputs.current[Math.min(pasted.length, CODE_LENGTH) - 1]?.focus();
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const code = digits.join("");
    if (!/^\d{6}$/.test(code)) return setError(t("ad.code.incomplete"));
    setBusy(true);
    const res = await api<{ user: unknown }>(channel === "phone" ? "/api/auth/otp/verify" : "/api/auth/email/otp/verify", {
      method: "POST",
      body: JSON.stringify(channel === "phone" ? { phone: contact, code } : { email: contact, code }),
    });
    setBusy(false);
    if (!res.ok) return setError(friendlyError(res.error));
    trackEvent("login", { method: channel === "phone" ? "phone" : "email" });
    onVerified();
  }

  return (
    <form className="tkn-pop-stack" onSubmit={(event) => void verify(event)} noValidate>
      <div role="group" aria-label={t("ad.code.group")} className="tkn-code">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(node) => {
              inputs.current[index] = node;
            }}
            className="tkn-code-box"
            aria-label={t("ad.code.digit", { index: index + 1 })}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={1}
            value={digit}
            onChange={(event) => setDigit(index, event.target.value)}
            onKeyDown={(event) => onKey(index, event)}
            onPaste={onPaste}
          />
        ))}
      </div>
      {error ? <p role="alert" className="tkn-pop-note">{error}</p> : null}
      <button type="submit" className="tkn-pop-btn" disabled={busy}>
        {t("ad.code.verify")}
      </button>
      <button type="button" className="tkn-pop-link" onClick={onChangeContact}>
        {t("ad.code.change")}
      </button>
    </form>
  );
}
