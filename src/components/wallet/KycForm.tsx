"use client";

import { useState } from "react";
import { api, fieldErrors, friendlyError } from "@/lib/ui/api";

export interface MaskedKyc {
  method: "bank" | "upi";
  legalName: string;
  pan: string;
  accountNumber?: string;
  ifsc?: string;
  upiId?: string;
  submittedAt: string | null;
}

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
      {kyc.method === "bank" ? (
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
  const [method, setMethod] = useState<"bank" | "upi">("bank");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [fields, setFields] = useState<Record<string, string[]>>({});

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "");
    const shared = { legalName: text("legalName"), pan: text("pan") };
    const body = method === "bank" ? { method, ...shared, accountNumber: text("accountNumber"), ifsc: text("ifsc") } : { method, ...shared, upiId: text("upiId") };
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
      <div role="radiogroup" aria-label="Payout method" style={{ display: "flex", gap: 8 }}>
        {(["bank", "upi"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={method === option}
            className={method === option ? "tk-btn tk-btn-gold" : "tk-btn tk-btn-outline-primary"}
            onClick={() => setMethod(option)}
            style={{ flex: 1 }}
          >
            {option === "bank" ? "Bank account" : "UPI ID"}
          </button>
        ))}
      </div>
      <Field label="Legal name (as on PAN)" name="legalName" error={fields.legalName} />
      <Field label="PAN" name="pan" error={fields.pan} maxLength={10} />
      {method === "bank" ? (
        <>
          <Field label="Bank account number" name="accountNumber" error={fields.accountNumber} inputMode="numeric" maxLength={18} />
          <Field label="IFSC" name="ifsc" error={fields.ifsc} maxLength={11} />
        </>
      ) : (
        <Field label="UPI ID" name="upiId" error={fields.upiId} placeholder="name@bank" />
      )}
      <label className="t-small" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <input type="checkbox" name="confirm" required style={{ marginTop: 3 }} />
        <span>I confirm these details are mine and match my PAN.</span>
      </label>
      <div aria-live="polite" className="t-small" style={{ color: "var(--danger, #a12626)", minHeight: 18 }}>
        {message}
      </div>
      <button type="submit" className="tk-btn tk-btn-gold" disabled={busy} style={{ width: "100%" }}>
        {busy ? "Saving" : "Save payout details"}
      </button>
    </form>
  );
}
