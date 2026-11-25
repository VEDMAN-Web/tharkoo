"use client";

import { useEffect, useState } from "react";
import { api, friendlyError, hasSessionHint } from "@/lib/ui/api";
import { waitingLine } from "@/components/ad/tourLabels";
import { SkRows } from "@/components/ui/Sk";

/** One call from GET /api/tours: the ad, the other person, the status, and what this person can do next. */
export type CallItem = {
  id: string;
  coins: number;
  status: string;
  /** "advertiser" is the vendor who owns the ad; the other role is the user who asked for the call. */
  role: "advertiser" | "buyer";
  requestedAt: string | null;
  joinUrl?: string | null;
  adTitle?: string | null;
  adSlug?: string | null;
  adPhoto?: string | null;
  otherName?: string;
  youEarn?: number;
  /** A waiting request the buyer made: how many requests for the same advertiser came in first. */
  ahead?: number | null;
  /** The advertiser is on another call right now. */
  busy?: boolean;
};

type Verb = "accept" | "decline" | "cancel";
type CallRole = "advertiser" | "buyer";

export const ACCEPT_WINDOW_MS = 30 * 60_000;
const POLL_MS = 20_000;

export type CallKey = "waiting" | "accepted" | "done" | "missed" | "refunded";

const STATES: Record<string, { key: CallKey; label: string }> = {
  requested: { key: "waiting", label: "Waiting" },
  accepted: { key: "accepted", label: "Accepted" },
  ending: { key: "accepted", label: "Accepted" },
  completed: { key: "done", label: "Done" },
  disputed: { key: "done", label: "Done" },
  expired: { key: "missed", label: "Missed" },
  declined: { key: "refunded", label: "Declined, credits returned" },
  failed: { key: "refunded", label: "Not connected, credits returned" },
  cancelled: { key: "refunded", label: "Cancelled, credits returned" },
  reversing: { key: "refunded", label: "Refunded" },
  reversed: { key: "refunded", label: "Refunded" },
};

export function callState(status: string): { key: CallKey; label: string } {
  return STATES[status] ?? { key: "done", label: status };
}

/** "25 min left to accept" for a waiting request, or "" once the 30 minutes are over. */
export function timeLeftLabel(requestedAt: string | null, now: number): string {
  if (!requestedAt) return "";
  const left = ACCEPT_WINDOW_MS - (now - new Date(requestedAt).getTime());
  if (!Number.isFinite(left) || left <= 0) return "";
  return `${Math.max(1, Math.ceil(left / 60_000))} min left to accept`;
}

const credits = (count: number) => `${count} ${count === 1 ? "credit" : "credits"}`;

/**
 * What the advertiser earns from a call, told by where the call stands: "you can earn" while it is waiting or accepted,
 * "you earned" once it is done, and nothing for a call that was declined, cancelled, missed, not connected or refunded.
 */
export function earnText(status: string, youEarn: number): string {
  if (status === "requested" || status === "accepted" || status === "ending") return ` · you can earn ${credits(youEarn)}`;
  if (status === "completed" || status === "disputed") return ` · you earned ${credits(youEarn)}`;
  return "";
}

export function CallRow({ row, now, busy, onAct }: { row: CallItem; now: number; busy: boolean; onAct: (row: CallItem, verb: Verb) => void }) {
  const state = callState(row.status);
  const vendor = row.role === "advertiser";
  const left = row.status === "requested" ? timeLeftLabel(row.requestedAt, now) : "";
  return (
    <li className="tkn-call-row" data-tk="call-row" data-status={state.key}>
      <span className="tkn-call-photo" aria-hidden="true">{row.adPhoto ? <img src={row.adPhoto} alt="" width={64} height={64} loading="lazy" /> : null}</span>
      <div className="tkn-call-main">
        {row.adSlug ? <a className="tkn-call-title" href={`/ad/${row.adSlug}/`}>{row.adTitle ?? "Ad"}</a> : <strong className="tkn-call-title">{row.adTitle ?? "Ad"}</strong>}
        <p className="tkn-call-meta">
          {vendor ? "Asked by" : "Vendor"} {row.otherName ?? "Member"} · {credits(row.coins)}
          {vendor && typeof row.youEarn === "number" ? earnText(row.status, row.youEarn) : ""}
        </p>
        <p className="tkn-call-status">
          <span className="tkn-call-chip" data-key={state.key}>{state.label}</span>
          {left ? <span className="tkn-call-left">{left}</span> : null}
        </p>
        {/* The buyer's place in the line, and a note when the advertiser is on another call. */}
        {!vendor && row.status === "requested" ? <p className="tkn-call-meta" data-tk="call-line">{waitingLine(row.ahead, row.busy === true)}</p> : null}
        {vendor && row.status === "requested" && row.busy ? <p className="tkn-call-meta" data-tk="call-busy">You are on another call. You can accept this one when it ends.</p> : null}
      </div>
      <div className="tkn-call-actions">
        {vendor && row.status === "requested" ? (
          <>
            <button type="button" className="tk-btn tk-btn-cta" disabled={busy || row.busy === true} onClick={() => onAct(row, "accept")}>Accept</button>
            <button type="button" className="tk-btn" disabled={busy} onClick={() => onAct(row, "decline")}>Decline</button>
          </>
        ) : null}
        {row.joinUrl && row.status === "accepted" ? <a className="tk-btn tk-btn-cta" href={row.joinUrl}>Join call</a> : null}
        {!vendor && (row.status === "requested" || row.status === "accepted") ? (
          <button type="button" className="tk-btn" disabled={busy} data-tk="call-cancel" onClick={() => onAct(row, "cancel")}>Cancel request</button>
        ) : null}
      </div>
    </li>
  );
}

/** H19.5: every video call of the signed-in person in one list: requests on their ads, and calls they asked for. Refreshes every 20 seconds. */
export function CallsList() {
  const [rows, setRows] = useState<CallItem[] | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hasSessionHint()) return;
    let live = true;
    const load = () =>
      api<CallItem[]>("/api/tours").then((res) => {
        if (!live) return;
        setRows(res.ok ? res.data : []);
        setNow(Date.now());
      });
    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, []);

  async function act(row: CallItem, verb: Verb) {
    setBusyId(row.id);
    setError("");
    // A dropped connection is not a crash: the person is told and can tap again.
    const res = await api<Partial<CallItem>>(`/api/tours/${encodeURIComponent(row.id)}/${verb}`, { method: "POST" }).catch(() => null);
    setBusyId("");
    if (!res) return setError("Could not reach the server. Please try again.");
    if (!res.ok) return setError(friendlyError(res.error));
    setRows((prev) => (prev ?? []).map((item) => (item.id === row.id ? { ...item, ...res.data, role: item.role } : item)));
  }

  // Two tabs: the requests on the person's own ads, and the calls they asked for. The first tab shown is the one that needs them now.
  const [picked, setPicked] = useState<CallRole | null>(null);
  const all = rows ?? [];
  const forMe = all.filter((row) => row.role === "advertiser");
  const mine = all.filter((row) => row.role === "buyer");
  const needsMe = forMe.filter((row) => row.status === "requested").length;
  const readyToJoin = mine.filter((row) => row.status === "accepted").length;
  const tab: CallRole = picked ?? (needsMe > 0 ? "advertiser" : readyToJoin > 0 || (forMe.length === 0 && mine.length > 0) ? "buyer" : "advertiser");
  const shown = tab === "advertiser" ? forMe : mine;

  return (
    <div data-tk="calls-list">
      {error ? <p role="alert" className="t-small" style={{ color: "var(--danger, #b00020)" }}>{error}</p> : null}
      {rows === null ? <SkRows label="Loading your calls" rows={3} /> : null}
      {rows && rows.length === 0 ? <p className="t-small" data-tk="calls-empty">No video calls yet. Calls you ask for, and requests on your ads, show here.</p> : null}
      {rows && rows.length ? (
        <>
          <div role="group" aria-label="Video calls" data-tk="calls-tabs" className="tkn-call-tabs">
            {(
              [
                ["advertiser", "Requests for me", needsMe],
                ["buyer", "My requests", readyToJoin],
              ] as const
            ).map(([key, label, count]) => (
              <button key={key} type="button" className="tkn-call-tab" aria-pressed={tab === key} data-tk={`calls-tab-${key}`} onClick={() => setPicked(key)}>
                {label}
                {count > 0 ? ` (${count})` : ""}
              </button>
            ))}
          </div>
          {shown.length === 0 ? (
            <p className="t-small" data-tk="calls-tab-empty">
              {tab === "advertiser" ? "Nobody has asked you for a video call yet." : "You have not asked for a video call yet. Open an ad and tap Video call."}
            </p>
          ) : (
            <ul className="tkn-call-list">
              {shown.map((row) => (
                <CallRow key={row.id} row={row} now={now} busy={busyId === row.id} onAct={(item, verb) => void act(item, verb)} />
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}
