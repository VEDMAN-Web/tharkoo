"use client";

import Link from "next/link";
import { useState } from "react";
import { Notice } from "@/components/admin/ui";
import { endDemoAdsAction } from "./demo-actions";

export function DemoAds({ total, active }: { total: number; active: number }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [left, setLeft] = useState(active);
  const phrase = `END ${left}`;
  const ready = left > 0 && typed.trim() === phrase;

  async function end() {
    if (!ready) return;
    setBusy(true);
    setMessage(null);
    const result = await endDemoAdsAction(typed);
    setBusy(false);
    if (!result.ok) return setMessage({ kind: "error", text: result.message });
    setLeft(0);
    setTyped("");
    setMessage({ kind: "info", text: `Ended ${result.ended} demo ${result.ended === 1 ? "ad" : "ads"}.` });
  }

  return (
    <section className="adm-card" aria-labelledby="demo-ads-heading" style={{ marginBottom: 16 }} data-tk="demo-ads">
      <h2 id="demo-ads-heading" className="t-h4">Demo ads</h2>
      <p className="t-small text-muted">
        {total} demo {total === 1 ? "ad" : "ads"}, {left} still live. Demo ads stay until you end them here.
      </p>
      <p className="t-small" style={{ margin: "8px 0" }}>
        <Link href="/admin/ads/?kind=demo" data-tk="filter-demo">Show only demo ads</Link> · <Link href="/admin/ads/?kind=real" data-tk="filter-real">Show only real ads</Link> · <Link href="/admin/ads/">Show all</Link>
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", margin: "12px 0 6px" }}>
        <label className="adm-field-label" htmlFor="demo-confirm" style={{ minWidth: 260 }}>
          {left > 0 ? `Type ${phrase} to confirm` : "No live demo ads to end"}
          <input id="demo-confirm" className="adm-input" type="text" autoComplete="off" value={typed} disabled={left === 0 || busy} onChange={(event) => setTyped(event.target.value)} />
        </label>
        <button type="button" className="adm-btn" data-tk="end-demo" disabled={!ready || busy} onClick={end}>
          {busy ? "Ending" : "End demo ads"}
        </button>
      </div>
      <p className="t-small text-muted" data-tk="end-demo-note">This ends every demo ad. Real ads are never touched.</p>
      {message ? (
        <div style={{ marginTop: 8 }}>
          <Notice kind={message.kind}>{message.text}</Notice>
        </div>
      ) : null}
    </section>
  );
}
