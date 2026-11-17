"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { undoAction } from "@/app/admin/undo-actions";
import { ReasonDialog, useToast } from "@/components/admin/ui";
import { adjustCreditsAction } from "./actions";
import { amountProblem, creditWords, type CreditsStart } from "./credits-format";

const REASONS = ["Goodwill", "Fixing a mistake", "Test or demo", "Other"] as const;

/** One key per opening of the dialog: a double click or a retry cannot add the same credits twice. */
function newRequestKey(seed: string) {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replace(/-/g, "") : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  return `${seed}${random}`.slice(0, 64);
}

/** The "Add or remove credits" dialog: direction, amount and a reason. Every change can be undone while unspent (UI-RULES section 3). */
export function CreditsDialog({ userId, name, balance, start, onClose }: { userId: string; name: string; balance: number; start: CreditsStart; onClose: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const id = useId();
  const [requestKey] = useState(() => newRequestKey("c"));
  const [mode, setMode] = useState<"add" | "remove">(start.mode);
  const [text, setText] = useState(start.amount);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const parsed = amountProblem(text, mode, balance);
  const shown = text !== "" && "error" in parsed ? parsed.error : error;
  const preview = "amount" in parsed ? balance + (mode === "add" ? parsed.amount : -parsed.amount) : null;

  async function undo(eventId: string) {
    const outcome = await undoAction(eventId);
    toast.show(outcome.ok ? { kind: "success", message: "Credit change undone." } : { kind: "error", message: outcome.message });
    router.refresh();
  }

  async function confirm(result: { reason: string; text: string }) {
    if (busy) return;
    if ("error" in parsed) {
      setError(parsed.error);
      return;
    }
    setBusy(true);
    const signed = mode === "add" ? parsed.amount : -parsed.amount;
    const reason = result.text ? `${result.reason}: ${result.text}` : result.reason;
    const done = await adjustCreditsAction({ userId, amount: signed, reason, requestKey });
    setBusy(false);
    onClose();
    if (!done.ok) {
      toast.show({ kind: "error", message: done.message });
      return;
    }
    const message = `${mode === "add" ? "Added" : "Removed"} ${creditWords(parsed.amount)} ${mode === "add" ? "to" : "from"} ${name}. New balance ${done.balance.toLocaleString("en-IN")}.`;
    if (done.eventId) toast.show({ kind: "undo", message, onUndo: () => void undo(done.eventId) });
    else toast.show({ kind: "success", message });
    router.refresh();
  }

  return (
    <ReasonDialog
      open
      title={`Add or remove credits for ${name}?`}
      body={
        <div className="adm-c-dlg" data-tk="credits-dialog">
          <p>
            Current balance: <strong data-tk="credits-balance">{creditWords(balance)}</strong>. Every change needs a reason and can be undone for 7 days while the credits are unspent.
          </p>
          <fieldset className="adm-k-opts">
            <legend className="adm-k-label">What do you want to do?</legend>
            <label className="adm-k-opt">
              <input type="radio" name={`${id}-mode`} checked={mode === "add"} onChange={() => { setMode("add"); setError(""); }} />
              Add credits
            </label>
            <label className="adm-k-opt">
              <input type="radio" name={`${id}-mode`} checked={mode === "remove"} onChange={() => { setMode("remove"); setError(""); }} />
              Remove credits
            </label>
          </fieldset>
          <div className="adm-k-field">
            <label className="adm-k-label" htmlFor={`${id}-amount`}>
              Number of credits<span className="adm-k-req" aria-hidden="true"> *</span>
            </label>
            <input
              id={`${id}-amount`}
              className="adm-k-input"
              inputMode="numeric"
              autoComplete="off"
              value={text}
              required
              aria-invalid={shown ? true : undefined}
              aria-describedby={`${id}-amount-help`}
              onChange={(event) => { setText(event.target.value); setError(""); }}
            />
            {shown ? (
              <p className="adm-k-err" id={`${id}-amount-help`} role="alert">{shown}</p>
            ) : (
              <p className="adm-k-help" id={`${id}-amount-help`}>{preview === null ? "A whole number. The balance never goes below 0." : `New balance: ${preview.toLocaleString("en-IN")} credits.`}</p>
            )}
          </div>
        </div>
      }
      reasons={REASONS}
      requireReason
      textLabel="Tell the team more"
      confirmLabel={mode === "add" ? "Add credits" : "Remove credits"}
      onCancel={onClose}
      onConfirm={(result) => void confirm(result)}
    />
  );
}
