"use client";

import { useCallback, useEffect, useState } from "react";
import { api, friendlyError } from "@/lib/ui/api";
import { CREDITS_CHANGED_EVENT } from "@/components/account/AccountContext";
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
    <div style={{ background: "var(--card, #fff)", borderRadius: 10, padding: "12px 14px", border: "1px solid var(--border)", boxShadow: "inset 0 3px 0 var(--rose)" }}>
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
    setMessage(`Request sent for ${amount} credits. Finance will review it.`);
    onDone();
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 10 }} aria-label="Withdraw credits">
      <h2 style={H2}>Withdraw</h2>
      <label style={{ display: "grid", gap: 6 }}>
        <span className="t-small">Credits to withdraw</span>
        <input
          name="coins"
          inputMode="numeric"
          value={coins}
          onChange={(event) => setCoins(event.target.value.replace(/\D/g, ""))}
          style={{ minHeight: 44, border: "1px solid var(--border)", borderRadius: 8, padding: "0 12px", fontSize: 16 }}
        />
      </label>
      <p className="t-small" style={{ color: "var(--muted)", margin: 0 }}>
        Minimum {summary.minWithdrawCoins} credits. One withdrawal every {summary.withdrawCooldownDays} days.
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
      <button type="submit" className="tk-btn tk-btn-cta" disabled={busy || Boolean(waiting) || !Number.isInteger(amount) || amount < summary.minWithdrawCoins || amount > summary.availableCoins} style={{ width: "100%" }}>
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
            <strong>{row.coins} credits</strong>
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

/** H19.10: one paid call in the earnings history: what the user paid, what Tharkoo kept and what the vendor got. */
type CallEarning = { id: string; title: string; price: number; fee: number; youGot: number; at: string | null };

function CallEarnings({ total, calls }: { total: number; calls: CallEarning[] }) {
  return (
    <section style={CARD} aria-label="Earned from calls" data-tk="call-earnings">
      <div>
        <p className="t-small" style={{ color: "var(--muted)", margin: 0 }}>Earned from calls</p>
        <p style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 800 }} data-tk="call-earnings-total">{total} credits</p>
      </div>
      {calls.length === 0 ? <p className="t-small" style={{ color: "var(--muted)", margin: 0 }}>No paid video calls yet.</p> : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
          {calls.map((call) => (
            <li key={call.id} style={{ borderTop: "1px solid var(--border)", paddingTop: 10, display: "grid", gap: 2 }} data-tk="call-earning">
              <strong className="t-small">{call.title || "Video call"}{call.at ? ` · ${date(call.at)}` : ""}</strong>
              <span className="t-small">Price: {call.price} credits</span>
              <span className="t-small">Tharkoo fee: {call.fee} credits</span>
              <span className="t-small"><strong>You got: {call.youGot} credits</strong></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function VendorEarnings({ onSignedOut }: { onSignedOut: () => void }) {
  const [panel, setPanel] = useState<"withdraw" | "ads">("withdraw");
  const [calls, setCalls] = useState<{ total: number; calls: CallEarning[] }>({ total: 0, calls: [] });
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [summaryRes, listRes, callsRes] = await Promise.all([
      api<PayoutSummary>("/api/wallet/payouts/summary"),
      api<{ items: WithdrawalRow[] }>("/api/wallet/payouts/withdrawals?page=1&pageSize=20"),
      api<{ total: number; calls: CallEarning[] }>("/api/wallet/call-earnings"),
    ]);
    if (callsRes.ok) setCalls(callsRes.data);
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
        <Stat label="Available" value={`${summary.availableCoins} credits`} />
        <Stat label="Pending payout" value={`${summary.pendingCoins} credits`} />
        <Stat label="Paid out" value={`${summary.paidCoins} credits`} />
      </section>
      <CallEarnings total={calls.total} calls={calls.calls} />
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }} role="group" aria-label="What to do with your earnings">
          <button type="button" className={panel === "withdraw" ? "tk-btn tk-btn-cta" : "tk-btn tk-btn-outline-primary"} aria-pressed={panel === "withdraw"} data-tk="earn-withdraw" onClick={() => setPanel("withdraw")} style={{ minHeight: 48 }}>Withdraw</button>
          <button type="button" className={panel === "ads" ? "tk-btn tk-btn-cta" : "tk-btn tk-btn-outline-primary"} aria-pressed={panel === "ads"} data-tk="earn-ads" onClick={() => setPanel("ads")} style={{ minHeight: 48 }}>Use for ads</button>
        </div>
        <p className="t-small" style={{ margin: 0, color: "var(--muted)" }} data-tk="earn-rate">1 earned credit = 1 ad credit. Ad credits pay for posting, TOP and Super Top.</p>
      </div>
      {panel === "ads" ? (
      <section style={CARD} aria-label="Move earnings to ad credits">
        <MoveToAdCredits available={summary.availableCoins} onDone={() => void load()} />
      </section>
      ) : (
      <>
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
      </>
      )}
    </div>
  );
}

/** H18.8: a vendor can use what they earned from calls to pay for posting, TOP or Super Top. At least 100 at a time. */
const MOVE_MIN = 100;

function MoveToAdCredits({ available, onDone }: { available: number; onDone: () => void }) {
  const [amount, setAmount] = useState(String(Math.max(MOVE_MIN, Math.min(available, MOVE_MIN))));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const value = Number(amount);
  const ok = Number.isInteger(value) && value >= MOVE_MIN && value <= available;
  async function move() {
    if (!ok || busy) return;
    setBusy(true);
    setMessage("");
    const res = await api<{ moved: number; adCredits: number }>("/api/payments/move-earnings", {
      method: "POST",
      body: JSON.stringify({ amount: value, idempotencyKey: `move-${Date.now()}-${Math.random().toString(36).slice(2, 10)}` }),
    });
    setBusy(false);
    if (!res.ok) return setMessage(friendlyError(res.error));
    setMessage(`Moved ${res.data.moved} credits. You now have ${res.data.adCredits} ad credits.`);
    window.dispatchEvent(new Event(CREDITS_CHANGED_EVENT));
    onDone();
  }
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <h2 style={H2}>Use earnings for ads</h2>
      <p className="t-small" style={{ margin: 0, color: "var(--muted)" }}>
        Move earned credits into ad credits to pay for posting, TOP or Super Top. At least {MOVE_MIN} at a time. This cannot be undone.
      </p>
      {available < MOVE_MIN ? (
        <p className="t-small" style={{ margin: 0 }}>You need at least {MOVE_MIN} earned credits to move them.</p>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <label htmlFor="move-amount" className="t-small" style={{ fontWeight: 700 }}>Credits to move</label>
          <input
            id="move-amount"
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, "").slice(0, 9))}
            style={{ minHeight: 44, minWidth: 0, flex: "1 1 120px", fontSize: 16, padding: "0 12px", borderRadius: 12, border: "2px solid #ead8f0" }}
          />
          <button type="button" className="tk-btn tk-btn-cta" disabled={!ok || busy} onClick={() => void move()} style={{ minHeight: 44, flex: "1 1 160px" }}>
            {busy ? "Moving" : "Move to ad credits"}
          </button>
        </div>
      )}
      {message ? <p className="t-small" role="status" style={{ margin: 0 }}>{message}</p> : null}
    </div>
  );
}
