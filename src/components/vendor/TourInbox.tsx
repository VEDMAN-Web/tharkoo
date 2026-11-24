"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Info, Video } from "lucide-react";
import { api, friendlyError, hasSessionHint } from "@/lib/ui/api";
import { roomLine, tourStatusLabel } from "../ad/tourLabels";

/** One row from GET /api/tours. Only the advertiser's rows are shown here. */
export type TourRow = {
  id: string;
  coins: number;
  status: string;
  role: "advertiser" | "buyer";
  /** H19.10: what the vendor keeps from this call, in credits. */
  youEarn?: number;
  requestedAt: string | null;
  joinUrl?: string | null;
};

function whenLabel(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
}

function coinsLabel(coins: number) {
  return `${coins} ${coins === 1 ? "credit" : "credits"}`;
}

export type EarnInfo = { sharePercent: number; options: { price: number; youKeep: number; rupees: number }[] };

const EARN_TIP = "You earn the moment both of you are on the call, even if it lasts one minute. Earnings can be withdrawn in crypto, or moved to ad credits to boost your ads.";

/** H19.10: what the vendor keeps from a call, in plain words, with a tooltip about when it is earned. */
export function EarnLine({ info }: { info: EarnInfo | null }) {
  const [open, setOpen] = useState(false);
  if (!info || info.options.length === 0) return null;
  return (
    <div data-tk="call-earn-info" style={{ margin: "8px 0" }}>
      {info.options.map((option) => (
        <p key={option.price} className="t-small" style={{ margin: "2px 0" }}>
          Users pay {option.price} credits per call. You keep {option.youKeep} credits (₹{option.rupees}). Tharkoo keeps the rest.
        </p>
      ))}
      <button type="button" className="tk-dlink" aria-expanded={open} aria-controls="call-earn-tip" onClick={() => setOpen((on) => !on)} style={{ display: "inline-flex", gap: 6, alignItems: "center", minHeight: 24 }}>
        <Info size={16} aria-hidden /> When do I earn?
      </button>
      {open ? <p id="call-earn-tip" role="note" className="t-small" style={{ margin: "4px 0 0" }}>{EARN_TIP}</p> : null}
    </div>
  );
}

/** The advertiser's inbox for live video tours: accept or decline requests, then join the room. */
export function TourInbox() {
  const [earn, setEarn] = useState<EarnInfo | null>(null);
  const [rows, setRows] = useState<TourRow[] | null>(null);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hasSessionHint()) return;
    let live = true;
    // H18.14: new requests show up without a reload.
    const load = () =>
      api<TourRow[]>("/api/tours").then((res) => {
        if (live) setRows(res.ok ? res.data : []);
      });
    void load();
    api<EarnInfo>("/api/tours/earn-info").then((res) => {
      if (live && res.ok) setEarn(res.data);
    });
    const timer = window.setInterval(() => void load(), 20_000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, []);

  async function act(tour: TourRow, verb: "accept" | "decline") {
    setBusyId(tour.id);
    setError("");
    const res = await api<Partial<TourRow>>(`/api/tours/${encodeURIComponent(tour.id)}/${verb}`, { method: "POST" });
    setBusyId("");
    if (!res.ok) return setError(friendlyError(res.error));
    setRows((prev) => (prev ?? []).map((row) => (row.id === tour.id ? { ...row, ...res.data, role: row.role } : row)));
  }

  const mine = (rows ?? []).filter((row) => row.role === "advertiser");

  if (rows && mine.length === 0 && !error) {
    return (
      <div id="tours-wrap">
      <p className="up-tour-line" id="tours" data-tk="tour-inbox" data-empty="yes">
        <Video size={18} aria-hidden /> <strong>Live video tours:</strong> no requests yet. <Link href="/how-it-works/" className="up-link">How video tours work</Link>
      </p>
        <EarnLine info={earn} />
      </div>
    );
  }

  return (
    <section className="tk-dcard" id="tours" aria-labelledby="tour-inbox-title" data-tk="tour-inbox" style={{ marginTop: 16 }}>
      <h2 id="tour-inbox-title">
        <Video size={20} aria-hidden /> Live video tours
      </h2>
      <EarnLine info={earn} />
      {error ? (
        <p role="alert" className="t-small" style={{ color: "var(--danger, #b00020)" }}>
          {error}
        </p>
      ) : null}
      {rows === null ? <p className="t-small">Loading tour requests…</p> : null}
      {mine.length ? (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
          {mine.map((tour) => {
            const when = whenLabel(tour.requestedAt);
            const room = roomLine(tour.joinUrl);
            return (
              <li key={tour.id} style={{ borderTop: "1px solid var(--line, #ddd)", paddingTop: 12 }}>
                <p>
                  <strong>{tourStatusLabel(tour.status)}</strong> · {coinsLabel(tour.coins)}
                </p>
                {typeof tour.youEarn === "number" ? <p className="t-small" data-tk="tour-earn">You earn {coinsLabel(tour.youEarn)}</p> : null}
                <p className="t-small" style={{ color: "var(--muted)" }}>
                  Requested {when}
                </p>
                {tour.status === "requested" ? (
                  <>
                    <p className="t-small">Accept within 30 minutes, or the caller is refunded.</p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="tk-btn tk-btn-cta"
                        disabled={busyId === tour.id}
                        aria-label={`Accept the tour request from ${when}`}
                        onClick={() => act(tour, "accept")}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="tk-btn tk-btn-outline-primary"
                        disabled={busyId === tour.id}
                        aria-label={`Decline the tour request from ${when}`}
                        onClick={() => act(tour, "decline")}
                      >
                        Decline
                      </button>
                    </div>
                  </>
                ) : null}
                {tour.status === "accepted" ? (
                  room.kind === "link" ? (
                    <a className="tk-dlink" href={room.href} target="_blank" rel="noopener noreferrer">
                      Join the room
                    </a>
                  ) : (
                    <p className="t-small">{room.text}</p>
                  )
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
