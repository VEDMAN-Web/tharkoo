"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { api, friendlyError } from "@/lib/ui/api";
import { useSellerStatus, type SellerStatus } from "@/components/availability/sellerStatus";
import { useFocusTrap } from "@/components/ui/useFocusTrap";
import { useT } from "@/components/ui/AdCard";


export type PopupKind = "call" | "chat";
export type FlowResult = "ok" | "auth" | "coins" | "error";
export type AdPopupAlt = { slug: string; href: string; title: string; place: string; price: string; photo?: string | null };

type Step = "login" | "code" | "call" | "away" | "buy" | "calling" | "error";
type Channel = "phone" | "email";
type Pack = { id: string; coins: number; price: number };
const PACKS_SHOWN = 3;

export type AdPopupProps = {
  kind: PopupKind;
  name: string;
  signedIn: boolean;
  seller?: SellerStatus;
  tourCoins: number | null;
  paymentsLive: boolean;
  alternatives: AdPopupAlt[];
  notice: string | null;
  onClose: () => void;
  onSignedIn: () => void;
  onStartCall: () => Promise<FlowResult>;
  onStartChat: () => Promise<FlowResult>;
  onSwitchToChat: () => void;
};

function firstStep(props: Pick<AdPopupProps, "kind" | "signedIn" | "seller">): Step {
  if (props.kind === "chat" || !props.signedIn) return "login";
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
  const [packs, setPacks] = useState<Pack[]>([]);
  const [pick, setPick] = useState(0);
  const [payError, setPayError] = useState("");
  const [showAllPacks, setShowAllPacks] = useState(false);

  useEffect(() => {
    if (step !== "call" && step !== "buy") return;
    let live = true;
    void api<{ balance: number }>("/api/wallet/").then((res) => {
      if (live && res.ok) setBalance(Number(res.data.balance) || 0);
    });
    return () => {
      live = false;
    };
  }, [step]);

  useEffect(() => {
    if (step !== "buy") return;
    let live = true;
    void api<{ packs: Pack[] }>("/api/wallet/coins").then((res) => {
      if (live && res.ok) setPacks(res.data.packs ?? []);
    });
    return () => {
      live = false;
    };
  }, [step]);

  async function afterLogin() {
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

  async function pay() {
    const pack = packs[pick];
    if (!pack) return setPayError(t("ad.buy.pick"));
    setBusy(true);
    setPayError("");
    const res = await api<{ checkoutUrl?: string | null }>("/api/wallet/coins/checkout", { method: "POST", body: JSON.stringify({ packId: pack.id }) });
    setBusy(false);
    if (!res.ok) return setPayError(friendlyError(res.error));
    if (res.data.checkoutUrl) return window.location.assign(res.data.checkoutUrl);
    setPayError(t("ad.buy.soon"));
  }

  const coins = props.tourCoins ?? 1;
  const coinUnit = coins === 1 ? t("ad.call.coinOne") : t("ad.call.coinMany", { count: coins });
  const title = titleFor(step, name, t);
  const help = helpFor(step, { kind, name, coins, coinText: coinUnit, contact: contact.value, t });

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
              <SellerRow name={name} status={seller?.status} t={t} />
              <div className="tkn-pop-tiles">
                <div className="tkn-pop-tile">
                  <p>{t("ad.call.cost")}</p>
                  <strong>{coinUnit}</strong>
                </div>
                <div className="tkn-pop-tile">
                  <p>{t("ad.call.balance")}</p>
                  <strong>{balance === null ? "…" : t("ad.call.coinMany", { count: balance })}</strong>
                </div>
              </div>
              {props.notice ? <p role="status" className="tkn-pop-note">{props.notice}</p> : null}
              <button type="button" className="tkn-pop-btn" disabled={busy} onClick={() => (balance === 0 ? setStep("buy") : void startCall())}>
                {balance === 0 ? t("ad.call.buy") : coins === 1 ? t("ad.call.start", { coins }) : t("ad.call.startMany", { coins })}
              </button>
              <button type="button" className="tkn-pop-btn-line" onClick={props.onSwitchToChat}>
                {t("ad.call.chatFirst", { name })}
              </button>
            </div>
          ) : null}

          {step === "away" ? (
            <div className="tkn-pop-stack">
              <SellerRow name={name} status="away" t={t} />
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
              <div role="radiogroup" aria-label={t("ad.buy.packs")} className="tkn-packs">
                {(showAllPacks ? packs : packs.slice(0, PACKS_SHOWN)).map((pack, index) => {
                  const on = index === pick;
                  return (
                    <button
                      key={pack.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      className="tkn-pack m-lift"
                      data-on={on ? "true" : undefined}
                      onClick={() => setPick(index)}
                    >
                      <span className="tkn-pack-n">{pack.coins}</span>
                      <span className="tkn-pack-l">{t("ad.buy.coins")}</span>
                      <span className="tkn-pack-p">₹{pack.price.toLocaleString("en-IN")}</span>
                    </button>
                  );
                })}
              </div>
              {packs.length > PACKS_SHOWN && !showAllPacks ? (
                <button type="button" className="tkn-pop-link" onClick={() => setShowAllPacks(true)}>
                  {t("ad.buy.more")}
                </button>
              ) : null}
              {props.paymentsLive ? (
                <button type="button" className="tkn-pop-btn" disabled={busy || packs.length === 0} onClick={() => void pay()}>
                  {t("ad.buy.pay", { amount: `₹${(packs[pick]?.price ?? 0).toLocaleString("en-IN")}` })}
                </button>
              ) : (
                <p role="status" className="tkn-pop-note">{t("ad.buy.soon")}</p>
              )}
              {payError ? <p role="status" className="tkn-pop-note">{payError}</p> : null}
              <p className="tkn-pop-sub">{t(coins === 1 ? "ad.buy.noteOne" : "ad.buy.noteMany")}</p>
            </div>
          ) : null}

          {step === "calling" ? (
            <div className="tkn-pop-stack tkn-pop-center">
              <span className="tkn-pop-ring" aria-hidden>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#5B21B6" strokeWidth="2.2" aria-hidden>
                  <rect x="3" y="6" width="13" height="12" rx="2" />
                  <path d="M16 10l5-3v10l-5-3" />
                </svg>
              </span>
              <button type="button" className="tkn-pop-btn-line" onClick={onClose}>
                {t("ad.calling.cancel")}
              </button>
            </div>
          ) : null}

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
      return t("ad.call.help");
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

function SellerRow({ name, status, t }: { name: string; status?: "online" | "away"; t: T }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const away = status === "away";
  return (
    <div className={`tkn-pop-seller${away ? " is-away" : ""}`}>
      <span className="tkn-pop-avatar" aria-hidden>{initial}</span>
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
      {alt.photo ? <img className="tkn-alt-photo" src={alt.photo} alt="" width={52} height={52} loading="lazy" /> : <span className="tkn-alt-photo" aria-hidden />}
      <span className="tkn-alt-text">
        <strong>{alt.title}</strong>
        <span>{t("ad.away.online", { place: alt.place })}</span>
      </span>
      <span className="tkn-alt-price">{alt.price}</span>
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
