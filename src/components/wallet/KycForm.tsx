"use client";

import { useEffect, useState } from "react";
import { api, fieldErrors, friendlyError } from "@/lib/ui/api";

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

const INPUT = { width: "100%", minHeight: 44, border: "1px solid var(--border)", borderRadius: 8, padding: "0 12px", fontSize: 16, background: "var(--card, #fff)", color: "var(--text)" } as const;

function Field({ label, name, error, ...rest }: { label: string; name: string; error?: string[]; placeholder?: string; inputMode?: "numeric" | "text"; maxLength?: number }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span className="t-small">{label}</span>
      <input name={name} required style={INPUT} autoComplete="off" {...rest} />
      {error?.[0] ? (
        <span className="t-small" role="alert" style={{ color: "var(--danger, #a12626)" }}>
          {error[0]}
        </span>
      ) : null}
    </label>
  );
}

/** Once the details are on file the vendor sees them masked. Changing them goes through support. */
export function KycSummary({ kyc }: { kyc: MaskedKyc }) {
  return (
    <dl className="t-small" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 14px", margin: 0 }}>
      <dt style={{ color: "var(--muted)" }}>Name</dt>
      <dd style={{ margin: 0 }}>{kyc.legalName}</dd>
      <dt style={{ color: "var(--muted)" }}>PAN</dt>
      <dd style={{ margin: 0 }}>{kyc.pan}</dd>
      {kyc.method === "crypto" ? (
        <>
          <dt style={{ color: "var(--muted)" }}>{kyc.coin ?? "USDT"} wallet</dt>
          <dd style={{ margin: 0, wordBreak: "break-all" }}>
            {kyc.network} · {kyc.walletAddress}
          </dd>
        </>
      ) : kyc.method === "bank" ? (
        <>
          <dt style={{ color: "var(--muted)" }}>Account</dt>
          <dd style={{ margin: 0 }}>{kyc.accountNumber}</dd>
          <dt style={{ color: "var(--muted)" }}>IFSC</dt>
          <dd style={{ margin: 0 }}>{kyc.ifsc}</dd>
        </>
      ) : (
        <>
          <dt style={{ color: "var(--muted)" }}>UPI ID</dt>
          <dd style={{ margin: 0 }}>{kyc.upiId}</dd>
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
    <form onSubmit={submit} style={{ display: "grid", gap: 14 }} aria-label="Payout details">
      <p className="t-small" style={{ color: "var(--muted)", margin: 0 }}>
        Add these once. They are stored encrypted and shown masked. A change needs support.
      </p>
      <p className="t-small" style={{ margin: 0 }}>
        Choose the coin you want to be paid in. Payouts are sent to your wallet and the rupee amount is converted at the day&apos;s rate. You see a range before you withdraw, and the admin confirms the exact amount.
      </p>
      <div role="radiogroup" aria-label="Coin and network" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {options.map((option, index) => (
          <button
            key={`${option.coin}-${option.network}`}
            type="button"
            role="radio"
            aria-checked={current === option}
            className={current === option ? "tk-btn tk-btn-cta" : "tk-btn tk-btn-outline-primary"}
            onClick={() => setChoice(index)}
            style={{ flex: "1 1 160px", minHeight: 44 }}
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
      <p className="t-small" style={{ color: "var(--muted)", margin: 0 }}>
        Check the address and network carefully. Crypto sent to a wrong address cannot be recovered.
      </p>
      <label className="t-small" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <input type="checkbox" name="confirm" required style={{ marginTop: 3 }} />
        <span>I confirm this wallet and these details are mine and match my PAN.</span>
      </label>
      <div aria-live="polite" className="t-small" style={{ color: "var(--danger, #a12626)", minHeight: 18 }}>
        {message}
      </div>
      <button type="submit" className="tk-btn tk-btn-cta" disabled={busy} style={{ width: "100%" }}>
        {busy ? "Saving" : "Save payout details"}
      </button>
    </form>
  );
}
