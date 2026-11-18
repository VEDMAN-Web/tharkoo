"use client";

import { useState } from "react";
import { Button, ReasonDialog, Toggle } from "@/components/admin/ui";
import type { MoneySettings } from "@/server/billing/money-settings";
import { saveMoneyAction } from "../_actions/actions";
import { checkNumbers, rupees } from "./prices-format";
import { useAnswer } from "./useAnswer";

/** Paid posting (switch, posting fee, credit price) and Payments (test payments switch, with a confirm when it is turned off). */
export function MoneyCard({ initial, canEdit }: { initial: MoneySettings; canEdit: boolean }) {
  const answer = useAnswer();
  const [fee, setFee] = useState(String(initial.postingFeeCredits));
  const [price, setPrice] = useState(String(initial.creditPriceInr));
  const [free, setFree] = useState(String(initial.freeAdsPerAccount));
  const [errors, setErrors] = useState<{ feeError?: string; priceError?: string; freeError?: string }>({});
  const [busy, setBusy] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);

  const dirty = fee !== String(initial.postingFeeCredits) || price !== String(initial.creditPriceInr) || free !== String(initial.freeAdsPerAccount);
  const parsed = checkNumbers(fee, price);
  const freeValue = Number(free.trim());
  const freeOk = free.trim() !== "" && Number.isInteger(freeValue) && freeValue >= 0 && freeValue <= 1000;

  async function save(values: Partial<MoneySettings>, message: string) {
    setBusy(true);
    const result = await saveMoneyAction(values, message);
    setBusy(false);
    return answer(result, message);
  }

  async function saveNumbers() {
    if (!parsed.ok || !freeOk) {
      setErrors({ feeError: parsed.ok ? undefined : parsed.feeError, priceError: parsed.ok ? undefined : parsed.priceError, freeError: freeOk ? undefined : "Enter a whole number from 0 to 1000." });
      return;
    }
    setErrors({});
    await save({ postingFeeCredits: parsed.fee, creditPriceInr: parsed.price, freeAdsPerAccount: freeValue }, "Posting fee, credit price and free ads saved.");
  }

  function discard() {
    setFee(String(initial.postingFeeCredits));
    setPrice(String(initial.creditPriceInr));
    setFree(String(initial.freeAdsPerAccount));
    setErrors({});
  }

  const feeHint = parsed.ok ? `About ${rupees(parsed.fee * parsed.price)} for each new ad` : "";

  return (
    <section className="adm-card adm-p-card" data-tk="money-settings" aria-label="Money settings">
      <div className="adm-p-row">
        <div className="adm-p-side">
          <h2>Paid posting</h2>
          <p>Every new ad costs credits. Editing an ad is free, and a live ad stays live while it is edited.</p>
        </div>
        <div className="adm-p-main">
          <Toggle
            checked={initial.paidPostingOn}
            disabled={!canEdit || busy}
            label={initial.paidPostingOn ? "Paid posting: On" : "Paid posting: Off"}
            onChange={(on) => void save({ paidPostingOn: on }, on ? "Paid posting is on. New ads cost the posting fee." : "Paid posting is off. Posting is free.")}
          />
          <div className="adm-p-fields">
            <div className="adm-k-field">
              <label className="adm-k-label" htmlFor="price-fee">
                Posting fee (credits)<span className="adm-k-req" aria-hidden="true"> *</span>
              </label>
              <input id="price-fee" className="adm-k-input" inputMode="numeric" autoComplete="off" disabled={!canEdit} value={fee} aria-invalid={errors.feeError ? true : undefined} aria-describedby="price-fee-help" onChange={(event) => { setFee(event.target.value); setErrors({}); }} />
              {errors.feeError ? <p className="adm-k-err" id="price-fee-help" role="alert">{errors.feeError}</p> : <p className="adm-k-help" id="price-fee-help">{feeHint || "A whole number of credits."}</p>}
            </div>
            <div className="adm-k-field">
              <label className="adm-k-label" htmlFor="price-credit">
                1 credit costs (₹)<span className="adm-k-req" aria-hidden="true"> *</span>
              </label>
              <input id="price-credit" className="adm-k-input" inputMode="numeric" autoComplete="off" disabled={!canEdit} value={price} aria-invalid={errors.priceError ? true : undefined} aria-describedby="price-credit-help" onChange={(event) => { setPrice(event.target.value); setErrors({}); }} />
              {errors.priceError ? <p className="adm-k-err" id="price-credit-help" role="alert">{errors.priceError}</p> : <p className="adm-k-help" id="price-credit-help">Used to show rupee values. Each pack has its own price.</p>}
            </div>
            <div className="adm-k-field">
              <label className="adm-k-label" htmlFor="price-free-ads">
                Free ads for each account<span className="adm-k-req" aria-hidden="true"> *</span>
              </label>
              <input id="price-free-ads" className="adm-k-input" inputMode="numeric" autoComplete="off" disabled={!canEdit} value={free} aria-invalid={errors.freeError ? true : undefined} aria-describedby="price-free-ads-help" onChange={(event) => { setFree(event.target.value); setErrors({}); }} />
              {errors.freeError ? <p className="adm-k-err" id="price-free-ads-help" role="alert">{errors.freeError}</p> : <p className="adm-k-help" id="price-free-ads-help">The first ads of every account cost nothing. You can give one person more in Users.</p>}
            </div>
          </div>
          {canEdit && dirty ? (
            <div className="adm-p-actions" role="group" aria-label="Save posting fee, credit price and free ads">
              <Button kind="quiet" onClick={discard}>Discard</Button>
              <Button kind="primary" busy={busy} onClick={() => void saveNumbers()}>Save changes</Button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="adm-p-row adm-p-row-line">
        <div className="adm-p-side">
          <h2>Payments</h2>
          <p>How people recharge. Changes are logged and can be undone for 30 days.</p>
        </div>
        <div className="adm-p-main">
          <Toggle
            checked={initial.mockPaymentsOn}
            disabled={!canEdit || busy}
            label={initial.mockPaymentsOn ? "Test payments: On" : "Test payments: Off"}
            onChange={(on) => (on ? void save({ mockPaymentsOn: true }, "Test payments are on. No money is taken.") : setConfirmOff(true))}
          />
          <p className="adm-k-help">Turning this off asks you to confirm.</p>
        </div>
      </div>

      {confirmOff ? (
        <ReasonDialog
          open
          title="Turn off test payments?"
          body={<p>People can then add credits only by paying. A payment gateway must be connected first, or nobody can recharge. You can undo this for 30 days.</p>}
          confirmLabel="Turn off test payments"
          danger
          onCancel={() => setConfirmOff(false)}
          onConfirm={() => {
            setConfirmOff(false);
            void save({ mockPaymentsOn: false }, "Test payments are off. People must pay to add credits.");
          }}
        />
      ) : null}
    </section>
  );
}
