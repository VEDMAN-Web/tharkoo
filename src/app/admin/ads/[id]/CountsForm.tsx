"use client";

import { useState } from "react";
import { Notice } from "@/components/admin/ui";
import { formatIndianCount } from "@/components/ad/counts-format";
import { readAdCountsAction, saveAdCountsAction } from "./actions";
import type { AdCountsView } from "@/server/listings/ad-counts";

type Message = { kind: "info" | "error"; text: string };

/** H6.17: two number fields for the shown views and clicks, with the real counts beside them. Admin and superadmin only. */
export function CountsForm({ listingId, initial }: { listingId: string; initial: AdCountsView }) {
  const [counts, setCounts] = useState<AdCountsView>(initial);
  const [views, setViews] = useState(String(initial.shown.views));
  const [clicks, setClicks] = useState(String(initial.shown.clicks));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  async function save() {
    const v = Number(views);
    const c = Number(clicks);
    if (!Number.isInteger(v) || v < 0 || !Number.isInteger(c) || c < 0) {
      setMessage({ kind: "error", text: "Enter whole numbers, 0 or more." });
      return;
    }
    setBusy(true);
    setMessage(null);
    const res = await saveAdCountsAction({ listingId, views: v, clicks: c });
    if (res.ok) {
      setCounts(res.counts);
      setViews(String(res.counts.shown.views));
      setClicks(String(res.counts.shown.clicks));
      setMessage({ kind: "info", text: "Saved. Visitors see these numbers plus every new view and click from now on." });
    } else {
      const fresh = await readAdCountsAction(listingId);
      if (fresh.ok) setCounts(fresh.counts);
      setMessage({ kind: "error", text: res.message });
    }
    setBusy(false);
  }

  return (
    <section className="adm-card" aria-labelledby="counts-heading">
      <h2 id="counts-heading" className="t-h4">Views and clicks</h2>
      <p className="t-small text-muted">
        Shown on the ad card and the ad page. The number you save is the starting point: every new unique view or click after you save is added on top. Visitors already counted before the save are not counted again.
      </p>
      <div className="adm-field-row" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", margin: "12px 0" }}>
        <div className="adm-field">
          <label className="adm-field-label" htmlFor="shown-views">Views shown</label>
          <input id="shown-views" className="adm-input" type="number" inputMode="numeric" min={0} step={1} value={views} onChange={(event) => setViews(event.target.value)} />
        </div>
        <div className="adm-field">
          <label className="adm-field-label" htmlFor="shown-clicks">Clicks shown</label>
          <input id="shown-clicks" className="adm-input" type="number" inputMode="numeric" min={0} step={1} value={clicks} onChange={(event) => setClicks(event.target.value)} />
        </div>
      </div>
      <dl className="t-small" style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: "4px 16px", margin: "0 0 12px" }} data-tk="real-counts">
        <dt className="text-muted">Real views so far</dt>
        <dd style={{ margin: 0 }}>{formatIndianCount(counts.real.views)} (read only)</dd>
        <dt className="text-muted">Real clicks so far</dt>
        <dd style={{ margin: 0 }}>{formatIndianCount(counts.real.clicks)} (read only)</dd>
        <dt className="text-muted">Shown now</dt>
        <dd style={{ margin: 0 }}>
          {formatIndianCount(counts.shown.views)} views, {formatIndianCount(counts.shown.clicks)} clicks
        </dd>
        <dt className="text-muted">Last set</dt>
        <dd style={{ margin: 0 }}>{counts.setAt ? new Date(counts.setAt).toLocaleString("en-IN") : "Never (shows the real counts)"}</dd>
      </dl>
      <button type="button" className="adm-btn" disabled={busy} onClick={save}>
        {busy ? "Saving" : "Save views and clicks"}
      </button>
      {message ? (
        <div style={{ marginTop: 12 }}>
          <Notice kind={message.kind === "error" ? "error" : "info"}>{message.text}</Notice>
        </div>
      ) : null}
    </section>
  );
}
