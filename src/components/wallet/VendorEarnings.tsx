"use client";

import { useCallback, useEffect, useState } from "react";
import { api, friendlyError } from "@/lib/ui/api";
import { CREDITS_CHANGED_EVENT } from "@/components/account/AccountContext";
import { KycForm, KycSummary, type MaskedKyc } from "@/components/wallet/KycForm";
import { date, dateTime, inr, STATUS_LABEL, statusTone } from "@/components/wallet/format";
import "./earnings.css";
import { SkStats } from "@/components/ui/Sk";

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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="ew-stat">
      <p className="ew-stat-label">{label}</p>
      <p className="ew-stat-value">{value}</p>
    </div>
  );
}

function WithdrawForm({ summary, onDone }: { summary: PayoutSummary; onDone: () => void }) {
  const [coins, setCoins] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [range, setRange] = useState("");
  const amount = Number(coins);
  const valid = Number.isInteger(amount) && amount > 0 && amount <= 1_000_000;
  const waiting = summary.nextWithdrawalAt ? new Date(summary.nextWithdrawalAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : null;

  // H19.9: the live range for the typed credits, looked up shortly after typing stops.
  useEffect(() => {
    if (!valid || summary.kyc?.method !== "crypto") return;
    let live = true;
    const timer = window.setTimeout(async () => {
      const res = await api<{ text: string | null }>(`/api/wallet/payouts/estimate?coins=${amount}`);
      if (live) setRange(res.ok && res.data.text ? res.data.text : "Rate unavailable, the admin confirms the exact amount");
    }, 400);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [amount, valid, summary.kyc?.method]);

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
    <form onSubmit={submit} className="ew-form" aria-label="Withdraw credits">
      <h2 className="ew-h2">Withdraw</h2>
      <label className="ew-field">
        <span className="ew-label">Credits to withdraw</span>
        <input
          name="coins"
          inputMode="numeric"
          value={coins}
          onChange={(event) => setCoins(event.target.value.replace(/\D/g, ""))}
          className="ew-input"
        />
      </label>
      <p className="ew-note">
        Minimum {summary.minWithdrawCoins} credits. One withdrawal every {summary.withdrawCooldownDays} days.
        {Number.isInteger(amount) && amount > 0 ? ` That is about ${inr(amount * summary.coinValueInr)} before deductions.` : ""}
        {` TDS ${summary.tdsPercent}% and GST ${summary.gstPercent}% are recorded on the payout.`}
      </p>
      {valid && range ? (
        <p className="ew-text ew-strong" role="status" data-tk="payout-range">
          {range}
        </p>
      ) : null}
      {waiting ? (
        <p className="ew-text ew-err" role="status">
          Your next withdrawal opens on {waiting}.
        </p>
      ) : null}
      <div aria-live="polite" className="ew-msg" data-ok={message.startsWith("Request sent") ? "yes" : undefined}>
        {message}
      </div>
      <button type="submit" className="tk-btn tk-btn-cta ew-btn" disabled={busy || Boolean(waiting) || !Number.isInteger(amount) || amount < summary.minWithdrawCoins || amount > summary.availableCoins}>
        {busy ? "Sending" : "Request withdrawal"}
      </button>
    </form>
  );
}

function WithdrawalHistory({ rows }: { rows: WithdrawalRow[] }) {
  if (rows.length === 0) return <p className="ew-note">No withdrawals yet.</p>;
  return (
    <ul className="ew-history">
      {rows.map((row) => (
        <li key={row.id}>
          <div className="ew-history-top">
            <span className="ew-chip" style={statusTone(row.status)}>{STATUS_LABEL[row.status] ?? row.status}</span>
            <strong>{row.coins} credits</strong>
          </div>
          <span className="ew-note">
            {dateTime(row.requestedAt)} · {inr(row.amountInr)} · TDS {row.tdsPercent}% · GST {row.gstPercent}%
            {row.reference ? ` · Ref ${row.reference}` : ""}
          </span>
          {row.reason && (row.status === "rejected" || row.status === "failed") ? (
            <span className="ew-text">Reason: {row.reason}</span>
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
    <section className="ew-card" aria-label="Earned from calls" data-tk="call-earnings">
      <div>
        <p className="ew-note">Earned from calls</p>
        <p className="ew-total" data-tk="call-earnings-total">{total} credits</p>
      </div>
      {calls.length === 0 ? <p className="ew-note">No paid video calls yet.</p> : (
        <ul className="ew-calls" data-tk="call-earnings-list" tabIndex={0} aria-label="Calls you earned from">
          {calls.map((call) => (
            <li key={call.id} className="ew-call" data-tk="call-earning">
              <strong className="ew-call-title">{call.title || "Video call"}{call.at ? <span className="ew-call-date"> · {date(call.at)}</span> : null}</strong>
              <div className="ew-call-nums">
                <span>Price: {call.price} credits</span>
                <span>Tharkoo fee: {call.fee} credits</span>
                <span className="ew-call-got">You got: {call.youGot} credits</span>
              </div>
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

  if (error) return <p className="ew-text ew-err" role="alert">{error}</p>;
  if (!summary) return <SkStats label="Loading earnings" />;

  return (
    <div className="ew-page">
      <section className="ew-stats" aria-label="Earnings">
        <Stat label="Available" value={`${summary.availableCoins} credits`} />
        <Stat label="Pending payout" value={`${summary.pendingCoins} credits`} />
        <Stat label="Paid out" value={`${summary.paidCoins} credits`} />
      </section>
      <CallEarnings total={calls.total} calls={calls.calls} />
      <div style={{ display: "grid", gap: 8 }}>
        <div className="ew-seg" role="group" aria-label="What to do with your earnings">
          <button type="button" className="ew-seg-btn" aria-pressed={panel === "withdraw"} data-tk="earn-withdraw" onClick={() => setPanel("withdraw")}>Withdraw</button>
          <button type="button" className="ew-seg-btn" aria-pressed={panel === "ads"} data-tk="earn-ads" onClick={() => setPanel("ads")}>Use for ads</button>
        </div>
        <p className="ew-note" data-tk="earn-rate">1 earned credit = 1 ad credit. Ad credits pay for posting, TOP and Super Top.</p>
      </div>
      {panel === "ads" ? (
      <section className="ew-card" aria-label="Move earnings to ad credits">
        <MoveToAdCredits available={summary.availableCoins} onDone={() => void load()} />
      </section>
      ) : (
      <>
      <section className="ew-card" aria-label="Payout details">
        <h2 className="ew-h2">Payout details</h2>
        {summary.kyc ? (
          <KycSummary kyc={summary.kyc} />
        ) : (
          <KycForm onSaved={() => void load()} />
        )}
      </section>
      {summary.kyc ? (
        <section className="ew-card">
          <WithdrawForm summary={summary} onDone={() => void load()} />
        </section>
      ) : null}
      <section className="ew-card" aria-label="Withdrawal history">
        <h2 className="ew-h2">Withdrawal history</h2>
        <WithdrawalHistory rows={rows} />
        {rows.length > 0 ? <p className="ew-note">Last requested {date(rows[0].requestedAt)}</p> : null}
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
    <div className="ew-form">
      <h2 className="ew-h2">Use earnings for ads</h2>
      <p className="ew-note">
        Move earned credits into ad credits to pay for posting, TOP or Super Top. At least {MOVE_MIN} at a time. This cannot be undone.
      </p>
      {available < MOVE_MIN ? (
        <p className="ew-text">You need at least {MOVE_MIN} earned credits to move them.</p>
      ) : (
        <div className="ew-field">
          <label htmlFor="move-amount" className="ew-label">Credits to move</label>
          <div className="ew-row">
          <input
            id="move-amount"
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, "").slice(0, 9))}
            className="ew-input"
          />
          <button type="button" className="tk-btn tk-btn-cta ew-btn" disabled={!ok || busy} onClick={() => void move()}>
            {busy ? "Moving" : "Move to ad credits"}
          </button>
          </div>
        </div>
      )}
      {message ? <p className="ew-text" role="status">{message}</p> : null}
    </div>
  );
}
