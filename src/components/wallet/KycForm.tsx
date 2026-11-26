"use client";

import { useEffect, useState } from "react";
import { api, fieldErrors, friendlyError } from "@/lib/ui/api";
import "./earnings.css";

export interface MaskedKyc {
  method: "bank" | "upi" | "crypto";
  legalName: string;
  pan: string;
  accountNumber?: string;
  ifsc?: string;
  upiId?: string;
  coin?: string;
  network?: string;
  walletAddress?: string;
  submittedAt: string | null;
}

/** One coin a vendor can be paid in. The server sends the list PassimPay supports. */
export interface CoinOption {
  coin: string;
  network: string;
  label: string;
  addressHint: string;
}

/** Shown until the server list arrives, and kept if it cannot be loaded: the two USDT options that always work. */
const DEFAULT_COINS: CoinOption[] = [
  { coin: "USDT", network: "TRC20", label: "USDT · TRON (TRC20)", addressHint: "starts with T" },
  { coin: "USDT", network: "BEP20", label: "USDT · BNB Chain (BEP20)", addressHint: "starts with 0x" },
];

function Field({ label, name, error, ...rest }: { label: string; name: string; error?: string[]; placeholder?: string; inputMode?: "numeric" | "text"; maxLength?: number }) {
  return (
    <label className="ew-field">
      <span className="ew-label">{label}</span>
      <input name={name} required className="ew-input" autoComplete="off" {...rest} />
      {error?.[0] ? (
        <span className="ew-text ew-err" role="alert">
          {error[0]}
        </span>
      ) : null}
    </label>
  );
}

/** Once the details are on file the vendor sees them masked. Changing them goes through support. */
export function KycSummary({ kyc }: { kyc: MaskedKyc }) {
  return (
    <dl className="ew-kv">
      <dt>Name</dt>
      <dd>{kyc.legalName}</dd>
      <dt>PAN</dt>
      <dd>{kyc.pan}</dd>
      {kyc.method === "crypto" ? (
        <>
          <dt>{kyc.coin ?? "USDT"} wallet</dt>
          <dd>
            {kyc.network} · {kyc.walletAddress}
          </dd>
        </>
      ) : kyc.method === "bank" ? (
        <>
          <dt>Account</dt>
          <dd>{kyc.accountNumber}</dd>
          <dt>IFSC</dt>
          <dd>{kyc.ifsc}</dd>
        </>
      ) : (
        <>
          <dt>UPI ID</dt>
          <dd>{kyc.upiId}</dd>
        </>
      )}
    </dl>
  );
}

export function KycForm({ onSaved }: { onSaved: (kyc: MaskedKyc) => void }) {
  // H18.6: payouts are sent in USDT through PassimPay; bank and UPI come back when a payout account is connected.
  const method = "crypto" as const;
  const [options, setOptions] = useState<CoinOption[]>(DEFAULT_COINS);
  const [choice, setChoice] = useState(0);
  const current = options[Math.min(choice, options.length - 1)];
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [fields, setFields] = useState<Record<string, string[]>>({});

  useEffect(() => {
    let live = true;
    void api<{ options: CoinOption[] }>("/api/wallet/payouts/coins").then((res) => {
      if (live && res.ok && res.data.options.length > 0) setOptions(res.data.options);
    });
    return () => {
      live = false;
    };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "");
    const shared = { legalName: text("legalName"), pan: text("pan") };
    const body = { method, ...shared, coin: current.coin, network: current.network, walletAddress: text("walletAddress") };
    setBusy(true);
    setMessage("");
    const res = await api<MaskedKyc>("/api/wallet/payouts/kyc", { method: "PUT", body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) {
      setFields(fieldErrors(res.error));
      setMessage(friendlyError(res.error));
      return;
    }
    setFields({});
    onSaved(res.data);
  }

  return (
    <form onSubmit={submit} className="ew-form" aria-label="Payout details">
      <p className="ew-note">
        Add these once. They are stored encrypted and shown masked. A change needs support.
      </p>
      <p className="ew-text">
        Choose the coin you want to be paid in. Payouts are sent to your wallet and the rupee amount is converted at the day&apos;s rate. You see a range before you withdraw, and the admin confirms the exact amount.
      </p>
      <div role="radiogroup" aria-label="Coin and network" className="ew-coins">
        {options.map((option, index) => (
          <button
            key={`${option.coin}-${option.network}`}
            type="button"
            role="radio"
            aria-checked={current === option}
            className="ew-coin"
            onClick={() => setChoice(index)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <Field label="Legal name (as on PAN)" name="legalName" error={fields.legalName} />
      <Field label="PAN" name="pan" error={fields.pan} maxLength={10} />
      <Field
        label={`${current.coin} wallet address (${current.network}, ${current.addressHint})`}
        name="walletAddress"
        error={fields.walletAddress}
        maxLength={64}
      />
      <p className="ew-note">
        Check the address and network carefully. Crypto sent to a wrong address cannot be recovered.
      </p>
      <label className="ew-check">
        <input type="checkbox" name="confirm" required />
        <span>I confirm this wallet and these details are mine and match my PAN.</span>
      </label>
      <div aria-live="polite" className="ew-msg">
        {message}
      </div>
      <button type="submit" className="tk-btn tk-btn-cta ew-btn" disabled={busy}>
        {busy ? "Saving" : "Save payout details"}
      </button>
    </form>
  );
}
