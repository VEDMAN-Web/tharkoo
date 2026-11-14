"use client";

import { useEffect, useState } from "react";
import { Video } from "lucide-react";
import { api, friendlyError, hasSessionHint } from "@/lib/ui/api";
import { roomLine, tourStatusLabel } from "../ad/tourLabels";

/** One row from GET /api/tours. Only the advertiser's rows are shown here. */
export type TourRow = {
  id: string;
  coins: number;
  status: string;
  role: "advertiser" | "buyer";
  requestedAt: string | null;
  joinUrl?: string | null;
};

function whenLabel(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
}

function coinsLabel(coins: number) {
  return `${coins} ${coins === 1 ? "coin" : "coins"}`;
}

/** The advertiser's inbox for live video tours: accept or decline requests, then join the room. */
export function TourInbox() {
  const [rows, setRows] = useState<TourRow[] | null>(null);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hasSessionHint()) return;
    let live = true;
    api<TourRow[]>("/api/tours").then((res) => {
      if (live) setRows(res.ok ? res.data : []);
    });
    return () => {
      live = false;
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

  return (
    <section className="tk-dcard" aria-labelledby="tour-inbox-title" data-tk="tour-inbox" style={{ marginTop: 16 }}>
      <h2 id="tour-inbox-title">
        <Video size={20} aria-hidden /> Live video tours
      </h2>
      {error ? (
        <p role="alert" className="t-small" style={{ color: "var(--danger, #b00020)" }}>
          {error}
        </p>
      ) : null}
      {rows === null ? <p className="t-small">Loading tour requests…</p> : null}
      {rows && mine.length === 0 ? <p className="t-small">No live video tour requests yet.</p> : null}
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
                <p className="t-small" style={{ color: "var(--muted)" }}>
                  Requested {when}
                </p>
                {tour.status === "requested" ? (
                  <>
                    <p className="t-small">Accept within 30 minutes, or the buyer is refunded.</p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="tk-btn tk-btn-gold"
                        disabled={busyId === tour.id}
                        aria-label={`Accept the tour request from ${when}`}
                        onClick={() => act(tour, "accept")}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="tk-btn tk-btn-outline-gold"
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
