"use client";

import { useState } from "react";
import { Notice, Toggle } from "@/components/admin/ui";
import type { MoneySettings } from "@/server/billing/money-settings";
import { saveMoneySettingsAction } from "./money-actions";

type Banner = { kind: "error" | "info"; text: string };

export function MoneySettingsForm({ initial }: { initial: MoneySettings }) {
  const [saved, setSaved] = useState(initial);
  const [fee, setFee] = useState(String(initial.postingFeeCredits));
  const [price, setPrice] = useState(String(initial.creditPriceInr));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Banner | null>(null);

  async function save(values: Partial<MoneySettings>, done: string) {
    setBusy(true);
    setNotice(null);
    const result = await saveMoneySettingsAction(values);
    setBusy(false);
    if (!result.ok) return setNotice({ kind: "error", text: result.error });
    setSaved(result.settings);
    setFee(String(result.settings.postingFeeCredits));
    setPrice(String(result.settings.creditPriceInr));
    setNotice({ kind: "info", text: done });
  }

  function saveNumbers() {
    const postingFeeCredits = Number(fee);
    const creditPriceInr = Number(price);
    if (!Number.isInteger(postingFeeCredits) || postingFeeCredits < 0) return setNotice({ kind: "error", text: "The posting fee must be a whole number, 0 or more." });
    if (!Number.isInteger(creditPriceInr) || creditPriceInr < 1) return setNotice({ kind: "error", text: "The credit price must be a whole number of rupees, 1 or more." });
    void save({ postingFeeCredits, creditPriceInr }, "Saved.");
  }

  const dirty = fee !== String(saved.postingFeeCredits) || price !== String(saved.creditPriceInr);

  return (
    <section className="adm-card" aria-labelledby="money-title" data-tk="money-settings">
      <h2 className="t-h3" id="money-title">Money</h2>
      <p className="t-small text-muted">Every change is recorded in the audit log.</p>
      <div style={{ display: "grid", gap: 12, maxWidth: 420, margin: "12px 0" }}>
        <label className="adm-field-label" htmlFor="money-fee">
          Ad posting fee (credits)
          <input id="money-fee" className="adm-input" type="number" inputMode="numeric" min={0} step={1} value={fee} onChange={(event) => setFee(event.target.value)} />
        </label>
        <label className="adm-field-label" htmlFor="money-price">
          Credit price (Rs)
          <input id="money-price" className="adm-input" type="number" inputMode="numeric" min={1} step={1} value={price} onChange={(event) => setPrice(event.target.value)} />
        </label>
        <div>
          <button type="button" className="adm-btn" disabled={busy || !dirty} onClick={saveNumbers}>
            {busy ? "Saving" : "Save"}
          </button>
        </div>
      </div>
      <h3 className="t-h4">Mock payments</h3>
      <p className="t-small text-muted">While on, anyone can add credits without paying (test payments). Turn this off before launch.</p>
      <Toggle
        checked={saved.mockPaymentsOn}
        onChange={(on) => void save({ mockPaymentsOn: on }, on ? "Saved. Test payments are on." : "Saved. Test payments are off.")}
        label="Mock payments: On"
        disabled={busy}
      />
      {notice ? (
        <div style={{ marginTop: 12 }}>
          <Notice kind={notice.kind}>{notice.text}</Notice>
        </div>
      ) : null}
    </section>
  );
}
