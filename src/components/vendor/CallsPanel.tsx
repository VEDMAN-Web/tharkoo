"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/ui/api";
import { TourInbox } from "./TourInbox";

type Row = { id: string; status: string; role: "advertiser" | "buyer"; coins: number; requestedAt: string | null; joinUrl?: string | null; adTitle?: string | null; adSlug?: string | null };

const STATUS: Record<string, string> = {
  requested: "Waiting for the vendor",
  accepted: "Accepted, join now",
  ending: "Finishing",
  completed: "Done",
  failed: "Not connected, credits returned",
  declined: "Declined, credits returned",
  expired: "Not answered in time, credits returned",
  cancelled: "Cancelled, credits returned",
};

/** H19.5: the user's own video call requests, with the ad, the status and a Join button when the vendor accepts. */
function MyCalls() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    let live = true;
    const load = () => api<Row[]>("/api/tours").then((res) => live && setRows(res.ok ? res.data.filter((row) => row.role === "buyer") : []));
    void load();
    const timer = window.setInterval(() => void load(), 20_000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, []);
  if (!rows || rows.length === 0) return null;
  return (
    <section className="tk-dcard" aria-labelledby="my-calls-title" data-tk="my-calls">
      <h2 id="my-calls-title" className="t-h3" style={{ margin: 0 }}>Calls you asked for</h2>
      <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid", gap: 10 }}>
        {rows.map((row) => (
          <li key={row.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, justifyContent: "space-between", borderTop: "1px solid #ead8f0", paddingTop: 10 }}>
            <div style={{ minWidth: 0, flex: "1 1 200px" }}>
              {row.adSlug ? <Link href={`/ad/${row.adSlug}/`} style={{ fontWeight: 700 }}>{row.adTitle ?? "Ad"}</Link> : <strong>{row.adTitle ?? "Ad"}</strong>}
              <p className="t-small" style={{ margin: "2px 0 0" }}>
                {STATUS[row.status] ?? row.status} · {row.coins} credits
              </p>
            </div>
            {row.joinUrl ? <a className="tk-btn tk-btn-cta" href={row.joinUrl} style={{ minHeight: 44 }}>Join call</a> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CallsPanel() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <TourInbox />
      <MyCalls />
    </div>
  );
}
