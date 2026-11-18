"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, fieldErrors, friendlyError } from "@/lib/ui/api";
import type { SellerView } from "@/server/auth/service";

interface Props {
  /** Same-origin return address, already checked on the server. */
  next: string;
  initial: SellerView | null;
  /** True while the account has no date of birth yet. Asked once, then never again. */
  askDateOfBirth: boolean;
  /** H7.4c: the Live chat switch as it is saved now. Off for existing sellers. */
  initialLiveChat?: boolean;
  /** The cities of the post-ad form. The city is picked from this list by its display name. */
  cities?: { id: string; name: string; slug: string }[];
}

/** H7.2b: the seller profile, shown once before the first ad. Name and city show on ads. Date of birth never shows. */
export function SellerProfileForm({ next, initial, askDateOfBirth, initialLiveChat = false, cities = [] }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const saved = (initial?.city ?? "").trim();
  const known = cities.find((item) => item.slug.toLowerCase() === saved.toLowerCase() || item.name.toLowerCase() === saved.toLowerCase());
  const [city, setCity] = useState(known?.name ?? saved);
  const [whatsapp, setWhatsapp] = useState(initial?.whatsapp ?? "");
  const [availableNow, setAvailableNow] = useState(initial?.availableNow ?? false);
  const [liveChat, setLiveChat] = useState(initialLiveChat);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setErrors({});
    const body = {
      name: name.trim(),
      city: city.trim(),
      whatsapp: whatsapp.trim(),
      availableNow,
      liveChat,
      ...(askDateOfBirth ? { dateOfBirth, adultConfirmed } : {}),
    };
    const res = await api<{ seller: SellerView }>("/api/auth/seller-profile", { method: "PUT", body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) {
      setErrors(fieldErrors(res.error));
      setMessage(friendlyError(res.error));
      return;
    }
    router.push(next);
    router.refresh();
  }

  const nameError = errors.name?.[0];
  const cityError = errors.city?.[0];
  const whatsappError = errors.whatsapp?.[0];
  const dobError = errors.dateOfBirth?.[0];

  return (
    <form className="tk-sp up-glass up-panel" onSubmit={save} noValidate aria-labelledby="tk-sp-title" data-tk="seller-profile">
      <style>{PROFILE_CSS}</style>
      <h1 id="tk-sp-title" className="tk-sp-title">About you</h1>
      <p className="tk-sp-help">This is what people see on your ads. You can change it any time.</p>

      <label className="tk-sp-label">
        <span>Name shown on your ads</span>
        <input className="tk-sp-input" name="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} aria-invalid={Boolean(nameError)} aria-describedby={nameError ? "tk-sp-name-err" : undefined} required />
        {nameError ? <span id="tk-sp-name-err" className="tk-sp-error">{nameError}</span> : null}
      </label>

      <label className="tk-sp-label">
        <span>City</span>
        {cities.length ? (
          <select className="tk-sp-input" name="city" autoComplete="off" value={city} onChange={(event) => setCity(event.target.value)} aria-invalid={Boolean(cityError)} aria-describedby={cityError ? "tk-sp-city-err" : undefined} required>
            <option value="" disabled>Choose your city</option>
            {!known && saved ? <option value={saved}>{saved}</option> : null}
            {cities.map((item) => (
              <option key={item.id} value={item.name}>{item.name}</option>
            ))}
          </select>
        ) : (
          <input className="tk-sp-input" name="city" autoComplete="address-level2" value={city} onChange={(event) => setCity(event.target.value)} aria-invalid={Boolean(cityError)} aria-describedby={cityError ? "tk-sp-city-err" : undefined} required />
        )}
        {cityError ? <span id="tk-sp-city-err" className="tk-sp-error">{cityError}</span> : null}
      </label>

      <label className="tk-sp-label">
        <span>WhatsApp number (optional)</span>
        <input className="tk-sp-input" name="whatsapp" type="tel" inputMode="tel" autoComplete="tel" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} aria-invalid={Boolean(whatsappError)} aria-describedby={whatsappError ? "tk-sp-wa-err" : undefined} />
        {whatsappError ? <span id="tk-sp-wa-err" className="tk-sp-error">{whatsappError}</span> : null}
      </label>

      <div className="tk-sp-switches" data-tk="sp-switches">
        <SwitchRow id="tk-sp-now" checked={availableNow} onChange={setAvailableNow} title="Available now" help="People see Online now on your ads." />
        <SwitchRow id="tk-sp-chat" checked={liveChat} onChange={setLiveChat} title="Live chat" help="People can chat with you on Tharkoo. Your ads show Online now or Away." />
      </div>

      {askDateOfBirth ? (
        <fieldset className="tk-sp-fieldset">
          <legend className="tk-sp-label-text">Date of birth</legend>
          <p className="tk-sp-help">Asked once, only for posting ads. Never shown on your ads.</p>
          <input className="tk-sp-input" name="dateOfBirth" type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} aria-label="Date of birth" aria-invalid={Boolean(dobError)} aria-describedby={dobError ? "tk-sp-dob-err" : undefined} required />
          <label className="up-check">
            <input type="checkbox" checked={adultConfirmed} onChange={(event) => setAdultConfirmed(event.target.checked)} required />
            <span>I am 18 or older and I will follow the posting rules.</span>
          </label>
          {dobError ? <span id="tk-sp-dob-err" className="tk-sp-error">{dobError}</span> : null}
        </fieldset>
      ) : null}

      <button type="submit" className="tk-sp-primary" disabled={busy}>
        {busy ? "Saving" : "Save and continue"}
      </button>
      <p aria-live="polite" className="tk-sp-error">{message}</p>
    </form>
  );
}

/** The same switch as the Available now and Live chat switches on the Account home: a real checkbox (role switch) over a track, so it works with the keyboard and a screen reader. */
function SwitchRow({ id, checked, onChange, title, help }: { id: string; checked: boolean; onChange: (next: boolean) => void; title: string; help: string }) {
  return (
    <label className={`tkv-avail tk-sp-switch${checked ? " is-on" : ""}`} data-tk="sp-switch">
      <span className="tkv-avail-text">
        <span className="tkv-avail-title">{title}</span>
        <span className="tkv-avail-help" id={`${id}-help`}>{help}</span>
      </span>
      <input id={id} className="tk-sp-sw" type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} aria-describedby={`${id}-help`} />
      <span className="tkv-switch" aria-hidden="true"><i /></span>
    </label>
  );
}

const PROFILE_CSS = `
.tk-sp{box-sizing:border-box;width:100%;max-width:640px;display:grid;gap:14px;color:#1E0B38}
.tk-sp-title{margin:0;font-size:20px;font-weight:800;letter-spacing:-.01em;color:#1E0B38}
.tk-sp-help{margin:0;font-size:14px;line-height:1.55;color:#4A2870}
.tk-sp-label,.tk-sp-label-text{display:grid;gap:8px;font-size:14px;font-weight:700}
.tk-sp-label-text{padding:0}
.tk-sp-fieldset{display:grid;gap:10px;margin:0;padding:0;border:0}
.tk-sp-input{width:100%;box-sizing:border-box;min-height:48px;border:1.5px solid #EAD8F0;border-radius:12px;padding:0 14px;font:inherit;font-size:16px;color:#1E0B38;background:#fff}
.tk-sp-switches{display:grid;gap:10px}
.tk-sp-switch{position:relative;padding:10px 16px;min-height:60px}
.tk-sp-sw{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}
.tk-sp-switch:has(.tk-sp-sw:focus-visible){outline:3px solid #7C3AED;outline-offset:2px}
.tk-sp-input:focus-visible,.up-check input:focus-visible,.tk-sp-primary:focus-visible{outline:3px solid #7C3AED;outline-offset:2px}
.tk-sp-primary{min-height:48px;border:0;border-radius:999px;background:linear-gradient(135deg,#D1137A,#A8124F);color:#fff;font:inherit;font-size:15px;font-weight:700;cursor:pointer}
.tk-sp-primary:disabled{opacity:.55;cursor:not-allowed}
.tk-sp-error{font-size:14px;color:#A8124F}
@media (prefers-reduced-motion:reduce){.tk-sp *{transition:none !important;animation:none !important}}
`;
