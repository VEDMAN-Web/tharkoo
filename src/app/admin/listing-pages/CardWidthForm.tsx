"use client";

import { useState } from "react";
import { Notice } from "@/components/admin/ui";
import { CARD_WIDTH_LABELS, type CardWidth } from "@/server/listings/card-width-config";
import { saveCardWidthAction } from "./card-width-actions";

/** H6.17: how wide the ad card list is on category and city pages. Phones are not affected. */
export function CardWidthForm({ initial }: { initial: CardWidth }) {
  const [width, setWidth] = useState<CardWidth>(initial);
  const [saved, setSaved] = useState<CardWidth>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    setNote("");
    const res = await saveCardWidthAction(width);
    setBusy(false);
    if (!res.ok) return setError(res.message);
    setSaved(width);
    setNote("Saved. Category and city pages show the new width within a minute.");
  }

  return (
    <section className="adm-card" aria-labelledby="card-width-heading">
      <h2 id="card-width-heading" className="t-h4">Card width</h2>
      <p className="t-small text-muted">Width of the ad cards on category and city pages. The photo size does not change. Phones are not affected.</p>
      <fieldset style={{ border: 0, padding: 0, margin: "12px 0", display: "grid", gap: 8 }}>
        <legend className="adm-field-label">Card width</legend>
        {(Object.keys(CARD_WIDTH_LABELS) as CardWidth[]).map((option) => (
          <label key={option} className="t-small" style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 24 }}>
            <input type="radio" name="card-width" value={option} checked={width === option} onChange={() => setWidth(option)} />
            {CARD_WIDTH_LABELS[option]}
          </label>
        ))}
      </fieldset>
      <button type="button" className="adm-btn" disabled={busy || width === saved} onClick={save}>
        {busy ? "Saving" : "Save card width"}
      </button>
      {error ? <div style={{ marginTop: 12 }}><Notice kind="error">{error}</Notice></div> : null}
      {note ? <div style={{ marginTop: 12 }}><Notice kind="info">{note}</Notice></div> : null}
    </section>
  );
}
