"use client";

import { useEffect, useId, useRef, useState } from "react";
import "@/styles/admin-kit.css";
import { Button } from "./Button";
import { validateReason } from "./kit-helpers";

export type ReasonResult = { reason: string; text: string; giveBack: boolean };

const FOCUSABLE = "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])";

/**
 * The confirm dialog (UI-RULES sections 3 and 5): a question title, what will happen, and when needed a reason list, free text,
 * a "Give back the 30 credits" box (off by default) or a typed confirm. Cancel left, confirm right (solid red when `danger`).
 * Focus moves in, Tab stays inside, Esc cancels, and focus returns to the trigger.
 */
export function ReasonDialog({
  open,
  title,
  body,
  reasons = [],
  requireReason = false,
  textLabel,
  requireText = false,
  paidAd,
  typedConfirm,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  /** A question that names the thing: "Remove this ad?" */
  title: string;
  /** What will happen and whether it can be undone. */
  body?: React.ReactNode;
  reasons?: readonly string[];
  requireReason?: boolean;
  /** Label for the free text box, for example "Tell the advertiser why". Leave out for no text box. */
  textLabel?: string;
  requireText?: boolean;
  /**
   * Set ONLY when the dialog rejects or removes a PAID ad. It adds the box "Give back the N credits to {name}" (off by default,
   * saved in History). Never set it for a ban, a delete or any other dialog.
   */
  paidAd?: { name: string; credits: number };
  /** The exact text to type, for bulk changes that remove many records: "END DEMO". */
  typedConfirm?: string;
  /** A verb: "Remove ad", "Ban user". Never "OK" or "Yes". */
  confirmLabel: string;
  danger?: boolean;
  onConfirm: (result: ReasonResult) => void;
  onCancel: () => void;
}) {
  const [picked, setPicked] = useState("");
  const [text, setText] = useState("");
  const [typed, setTyped] = useState("");
  const [refund, setRefund] = useState(false);
  const [tried, setTried] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const cancelRef = useRef(onCancel);
  const id = useId();

  useEffect(() => {
    cancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("input,textarea,button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        cancelRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel.current) return;
      const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((node) => node.getClientRects().length > 0);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  const check = validateReason({
    reasons,
    requireReason,
    requireText,
    pickedReason: picked,
    text,
    typedConfirm,
    typed,
  });
  const errors = tried ? check.errors : {};

  function submit() {
    setTried(true);
    if (!check.ok) return;
    onConfirm({ reason: picked, text: text.trim(), giveBack: Boolean(paidAd) && refund });
  }

  return (
    <div className="adm-k adm-k-scrim" onMouseDown={(event) => event.target === event.currentTarget && onCancel()} data-tk="reason-scrim">
      <div ref={panel} className="adm-k-dlg" role="alertdialog" aria-modal="true" aria-labelledby={`${id}-t`} aria-describedby={body ? `${id}-b` : undefined} data-tk="reason-dialog">
        <div className="adm-k-dlg-h">
          <h2 id={`${id}-t`}>{title}</h2>
        </div>
        <div className="adm-k-dlg-b">
          {body ? <div id={`${id}-b`}>{body}</div> : null}
          {reasons.length > 0 ? (
            <fieldset className="adm-k-opts" aria-describedby={errors.reason ? `${id}-re` : undefined}>
              <legend className="adm-k-label">
                Reason{requireReason ? <span className="adm-k-req" aria-hidden="true"> *</span> : null}
              </legend>
              {reasons.map((reason) => (
                <label key={reason} className="adm-k-opt">
                  <input type="radio" name={`${id}-reason`} value={reason} checked={picked === reason} onChange={() => setPicked(reason)} />
                  {reason}
                </label>
              ))}
              {errors.reason ? <p className="adm-k-err" id={`${id}-re`}>{errors.reason}</p> : null}
            </fieldset>
          ) : null}
          {textLabel ? (
            <div className="adm-k-field">
              <label className="adm-k-label" htmlFor={`${id}-text`}>
                {textLabel}
                {requireText || picked === "Other" ? <span className="adm-k-req" aria-hidden="true"> *</span> : null}
              </label>
              <textarea
                id={`${id}-text`}
                className="adm-k-input"
                rows={3}
                value={text}
                required={requireText || picked === "Other"}
                aria-invalid={errors.text ? true : undefined}
                aria-describedby={errors.text ? `${id}-te` : undefined}
                onChange={(event) => setText(event.target.value)}
              />
              {errors.text ? <p className="adm-k-err" id={`${id}-te`}>{errors.text}</p> : null}
            </div>
          ) : null}
          {paidAd ? (
            <label className="adm-k-opt" data-tk="give-back">
              <input type="checkbox" checked={refund} onChange={(event) => setRefund(event.target.checked)} />
              <span>
                <strong>Give back the {paidAd.credits.toLocaleString("en-IN")} credits to {paidAd.name}</strong>
                <span className="adm-k-help" style={{ display: "block" }}>Off by default. Saved in History.</span>
              </span>
            </label>
          ) : null}
          {typedConfirm ? (
            <div className="adm-k-field">
              <label className="adm-k-label" htmlFor={`${id}-typed`}>
                Type {typedConfirm} to confirm<span className="adm-k-req" aria-hidden="true"> *</span>
              </label>
              <input
                id={`${id}-typed`}
                className="adm-k-input"
                value={typed}
                autoComplete="off"
                aria-invalid={errors.typed ? true : undefined}
                aria-describedby={errors.typed ? `${id}-ye` : undefined}
                onChange={(event) => setTyped(event.target.value)}
              />
              {errors.typed ? <p className="adm-k-err" id={`${id}-ye`}>{errors.typed}</p> : <p className="adm-k-help">Typed confirm is used only for bulk changes that remove many records.</p>}
            </div>
          ) : null}
        </div>
        <div className="adm-k-dlg-f">
          <Button kind="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <span className="adm-k-sp" />
          <Button kind={danger ? "danger-solid" : "primary"} onClick={submit}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
