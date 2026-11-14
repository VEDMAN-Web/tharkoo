"use client";

import { useCallback, useEffect, useState } from "react";
import { api, friendlyError } from "@/lib/ui/api";
import { KycForm, KycSummary, type MaskedKyc } from "@/components/wallet/KycForm";
import { date, dateTime, inr, STATUS_LABEL, statusTone } from "@/components/wallet/format";

export interface PayoutSummary {
  availableCoins: number;
  pendingCoins: number;
  paidCoins: number;
  coinValueInr: number;
  tdsPercent: number;
  gstPercent: number;
  minWithdrawCoins: number;
  withdrawCooldownDays: number;
  nextWithdrawalAt: string | null;
  kyc: MaskedKyc | null;
}

interface WithdrawalRow {
  id: string;
  status: string;
  method: string;
  coins: number;
  amountInr: number;
  tdsPercent: number;
  gstPercent: number;
  reference: string | null;
  reason: string | null;
  requestedAt: string;
}

const CARD = { border: "1px solid var(--border)", borderRadius: 12, padding: 14, background: "var(--card, #fff)", display: "grid", gap: 16 } as const;
const H2 = { fontSize: 18, margin: 0 } as const;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--card, #fff)", borderRadius: 10, padding: "12px 14px", border: "1px solid var(--border)", boxShadow: "inset 0 3px 0 var(--gold)" }}>
      <p className="t-small" style={{ color: "var(--muted)", margin: 0 }}>{label}</p>
      <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 700 }}>{value}</p>
    </div>
  );
}

function WithdrawForm({ summary, onDone }: { summary: PayoutSummary; onDone: () => void }) {
  const [coins, setCoins] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const amount = Number(coins);
  const waiting = summary.nextWithdrawalAt ? new Date(summary.nextWithdrawalAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setBusy(true);
    const res = await api<{ coins: number }>("/api/wallet/payouts/withdrawals", { method: "POST", body: JSON.stringify({ coins: amount }) });
    setBusy(false);
    if (!res.ok) return setMessage(friendlyError(res.error));
    setCoins("");
    setMessage(`Request sent for ${amount} coins. Finance will review it.`);
    onDone();
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 10 }} aria-label="Withdraw coins">
      <h2 style={H2}>Withdraw</h2>
      <label style={{ display: "grid", gap: 6 }}>
        <span className="t-small">Coins to withdraw</span>
        <input
          name="coins"
          inputMode="numeric"
          value={coins}
          onChange={(event) => setCoins(event.target.value.replace(/\D/g, ""))}
          style={{ minHeight: 44, border: "1px solid var(--border)", borderRadius: 8, padding: "0 12px", fontSize: 16 }}
        />
      </label>
      <p className="t-small" style={{ color: "var(--muted)", margin: 0 }}>
        Minimum {summary.minWithdrawCoins} coins. One withdrawal every {summary.withdrawCooldownDays} days.
        {Number.isInteger(amount) && amount > 0 ? ` That is about ${inr(amount * summary.coinValueInr)} before deductions.` : ""}
        {` TDS ${summary.tdsPercent}% and GST ${summary.gstPercent}% are recorded on the payout.`}
      </p>
      {waiting ? (
        <p className="t-small" role="status" style={{ color: "var(--accent)", margin: 0 }}>
          Your next withdrawal opens on {waiting}.
        </p>
      ) : null}
      <div aria-live="polite" className="t-small" style={{ minHeight: 18, color: message.startsWith("Request sent") ? "var(--ok, #1f7a3a)" : "var(--danger, #a12626)" }}>
        {message}
      </div>
      <button type="submit" className="tk-btn tk-btn-gold" disabled={busy || Boolean(waiting) || !Number.isInteger(amount) || amount < summary.minWithdrawCoins || amount > summary.availableCoins} style={{ width: "100%" }}>
        {busy ? "Sending" : "Request withdrawal"}
      </button>
    </form>
  );
}

function WithdrawalHistory({ rows }: { rows: WithdrawalRow[] }) {
  if (rows.length === 0) return <p className="t-small" style={{ color: "var(--muted)", margin: 0 }}>No withdrawals yet.</p>;
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
      {rows.map((row) => (
        <li key={row.id} style={{ borderTop: "1px solid var(--border)", paddingTop: 10, display: "grid", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ ...statusTone(row.status), borderRadius: 999, padding: "2px 10px", fontSize: 13, fontWeight: 600 }}>{STATUS_LABEL[row.status] ?? row.status}</span>
            <strong>{row.coins} coins</strong>
          </div>
          <span className="t-small" style={{ color: "var(--muted)" }}>
            {dateTime(row.requestedAt)} · {inr(row.amountInr)} · TDS {row.tdsPercent}% · GST {row.gstPercent}%
            {row.reference ? ` · Ref ${row.reference}` : ""}
          </span>
          {row.reason && (row.status === "rejected" || row.status === "failed") ? (
            <span className="t-small">Reason: {row.reason}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function VendorEarnings({ onSignedOut }: { onSignedOut: () => void }) {
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [summaryRes, listRes] = await Promise.all([
      api<PayoutSummary>("/api/wallet/payouts/summary"),
      api<{ items: WithdrawalRow[] }>("/api/wallet/payouts/withdrawals?page=1&pageSize=20"),
    ]);
    if (!summaryRes.ok) {
      if (summaryRes.status === 401) return onSignedOut();
      return setError(friendlyError(summaryRes.error));
    }
    setSummary(summaryRes.data);
    if (listRes.ok) setRows(listRes.data.items);
  }, [onSignedOut]);

  useEffect(() => {
    const id = window.setTimeout(load, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  if (error) return <p className="t-small" role="alert" style={{ color: "var(--danger, #a12626)" }}>{error}</p>;
  if (!summary) return <p className="t-small" style={{ color: "var(--muted)" }}>Loading earnings</p>;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }} aria-label="Earnings">
        <Stat label="Available" value={`${summary.availableCoins} coins`} />
        <Stat label="Pending payout" value={`${summary.pendingCoins} coins`} />
        <Stat label="Paid out" value={`${summary.paidCoins} coins`} />
      </section>
      <section style={CARD} aria-label="Payout details">
        <h2 style={H2}>Payout details</h2>
        {summary.kyc ? (
          <KycSummary kyc={summary.kyc} />
        ) : (
          <KycForm onSaved={() => void load()} />
        )}
      </section>
      {summary.kyc ? (
        <section style={CARD}>
          <WithdrawForm summary={summary} onDone={() => void load()} />
        </section>
      ) : null}
      <section style={CARD} aria-label="Withdrawal history">
        <h2 style={H2}>Withdrawal history</h2>
        <WithdrawalHistory rows={rows} />
        {rows.length > 0 ? <p className="t-small" style={{ color: "var(--muted)", margin: 0 }}>Last requested {date(rows[0].requestedAt)}</p> : null}
      </section>
    </div>
  );
}
