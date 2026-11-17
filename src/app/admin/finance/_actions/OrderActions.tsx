"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { undoAction } from "@/app/admin/undo-actions";
import { Button, LockBadge, ReasonDialog, useToast } from "@/components/admin/ui";
import type { OrderRow } from "@/server/admin/orders";
import { giveBackAction, markFailedAction, markPaidAction, type MoneyActionResult } from "./actions";

type Choice = "paid" | "failed" | "refund";

const credits = (count: number) => `${count.toLocaleString("en-IN")} ${count === 1 ? "credit" : "credits"}`;

/** "What to do" for one recharge (H8.24): mark paid, mark failed, or give credits back. A reason is always needed. Never contacts a payment provider. */
export function OrderActions({ row }: { row: OrderRow }) {
  const act = row.act;
  const toast = useToast();
  const router = useRouter();
  const [choice, setChoice] = useState<Choice | "">("");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState(String(act?.refundable ?? ""));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmRefund, setConfirmRefund] = useState(false);
  if (!act) return null;

  async function undo(eventId: string) {
    const outcome = await undoAction(eventId);
    toast.show(outcome.ok ? { kind: "success", message: "Change undone." } : { kind: "error", message: outcome.message });
    router.refresh();
  }

  function answer(result: MoneyActionResult, message: string) {
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setChoice("");
    setReason("");
    if (result.undoUntil) toast.show({ kind: "undo", message, onUndo: () => void undo(result.eventId) });
    else toast.show({ kind: "success", message });
    router.refresh();
  }

  const amountNumber = Number(amount.trim());
  const amountOk = amount.trim() !== "" && Number.isInteger(amountNumber) && amountNumber >= 1 && amountNumber <= act.refundable;

  function validate(): boolean {
    if (!choice) return false;
    if (reason.trim().length < 1) {
      setError("Write why you are doing this.");
      return false;
    }
    if (choice === "refund" && !amountOk) {
      setError(`Enter a whole number of credits from 1 to ${act?.refundable.toLocaleString("en-IN")}.`);
      return false;
    }
    setError("");
    return true;
  }

  async function submit() {
    if (busy || !act || !validate()) return;
    if (choice === "refund") {
      setConfirmRefund(true);
      return;
    }
    setBusy(true);
    const input = { paymentId: act.paymentId, reason: reason.trim() };
    const result = choice === "paid" ? await markPaidAction(input) : await markFailedAction(input);
    setBusy(false);
    answer(result, choice === "paid" ? `${row.ref} marked paid. ${credits(act.credits)} added.` : `${row.ref} marked failed.`);
  }

  async function giveBack() {
    if (busy || !act) return;
    setConfirmRefund(false);
    setBusy(true);
    const result = await giveBackAction({ paymentId: act.paymentId, amount: amountNumber, reason: reason.trim() });
    setBusy(false);
    answer(result, `${credits(amountNumber)} given back for ${row.ref}.`);
  }

  const options: { key: Choice; title: string; hint: string }[] = [
    ...(act.markPaid ? [{ key: "paid" as const, title: `Mark paid and add ${credits(act.credits)}`, hint: "Use when the payment was received" }] : []),
    ...(act.markFailed ? [{ key: "failed" as const, title: "Mark failed", hint: "No credits are added" }] : []),
    ...(act.refund ? [{ key: "refund" as const, title: "Give credits back", hint: `Up to ${credits(act.refundable)}. This cannot be undone` }] : []),
  ];
  const label = choice === "paid" ? `Mark paid, add ${credits(act.credits)}` : choice === "failed" ? "Mark failed" : choice === "refund" ? "Give credits back..." : "Choose what to do";

  return (
    <section className="adm-o-act" data-tk="order-actions" aria-labelledby="order-actions-title">
      <h3 id="order-actions-title" className="adm-o-h">
        What to do<span className="adm-k-req" aria-hidden="true"> *</span>
      </h3>
      <fieldset className="adm-k-opts">
        <legend className="adm-k-sr">What to do</legend>
        {options.map((option) => (
          <label key={option.key} className="adm-k-opt">
            <input
              type="radio"
              name="order-choice"
              checked={choice === option.key}
              onChange={() => {
                setChoice(option.key);
                setError("");
              }}
            />
            <span>
              <strong>{option.title}</strong>
              <span className="adm-k-help" style={{ display: "block" }}>{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {choice === "refund" ? (
        <div className="adm-k-field">
          <label className="adm-k-label" htmlFor="order-amount">Credits to give back</label>
          <input
            id="order-amount"
            className="adm-k-input"
            inputMode="numeric"
            autoComplete="off"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setError("");
            }}
          />
        </div>
      ) : null}
      {choice ? (
        <div className="adm-k-field">
          <label className="adm-k-label" htmlFor="order-reason">
            Reason<span className="adm-k-req" aria-hidden="true"> *</span>
          </label>
          <input
            id="order-reason"
            className="adm-k-input"
            autoComplete="off"
            maxLength={500}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setError("");
            }}
          />
          <p className="adm-k-help">{choice === "paid" ? "Written to History. Adding credits can be undone for 7 days while unspent." : "Written to History."}</p>
        </div>
      ) : null}
      {choice === "refund" ? <LockBadge reason="Credits given back cannot be undone." /> : null}
      {error ? (
        <p className="adm-k-err" role="alert" data-tk="order-action-error">
          {error}
        </p>
      ) : null}
      <div className="adm-o-actbar">
        <Button
          disabled={!choice || busy}
          onClick={() => {
            setChoice("");
            setReason("");
            setError("");
          }}
        >
          Cancel
        </Button>
        <span className="adm-k-sp" />
        <Button kind="primary" busy={busy} disabled={!choice} onClick={() => void submit()}>
          {label}
        </Button>
      </div>
      {confirmRefund ? (
        <ReasonDialog
          open
          title={`Give ${credits(amountNumber)} back?`}
          body={<p>{credits(amountNumber)} go back to {row.who} for {row.ref}. This is saved in History and cannot be undone.</p>}
          confirmLabel={`Give ${credits(amountNumber)} back`}
          danger
          onCancel={() => setConfirmRefund(false)}
          onConfirm={() => void giveBack()}
        />
      ) : null}
    </section>
  );
}
