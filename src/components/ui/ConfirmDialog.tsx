"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";

type Props = {
  open: boolean;
  title: string;
  text?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" makes the confirm button red, for deleting, removing or blocking. Default is the brand pink. */
  tone?: "primary" | "danger";
  busy?: boolean;
  /** Adds a text box (a reason, for example). Its trimmed text is passed to onConfirm. */
  input?: { label: string; placeholder?: string; maxLength?: number; required?: boolean };
  onConfirm: (value: string) => void;
  onCancel: () => void;
};

function Body({ title, text, confirmLabel = "Confirm", cancelLabel = "Cancel", tone = "primary", busy = false, input, onConfirm, onCancel }: Omit<Props, "open">) {
  const [value, setValue] = useState("");
  const missing = Boolean(input?.required && !value.trim());
  return (
    <>
      <h2 className="t-h3">{title}</h2>
      {text ? <p className="t-body mt-2 text-muted">{text}</p> : null}
      {input ? (
        <label className="t-small mt-3 block">
          {input.label}
          <textarea
            className="tk-input mt-1 w-full"
            rows={3}
            maxLength={input.maxLength ?? 500}
            value={value}
            placeholder={input.placeholder}
            onChange={(event) => setValue(event.target.value)}
            style={{ fontSize: 16 }}
          />
        </label>
      ) : null}
      <div className="tk-confirm-actions">
        <button type="button" className="tk-confirm-btn tk-confirm-btn--cancel" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={`tk-confirm-btn tk-confirm-btn--${tone}`}
          onClick={() => onConfirm(value.trim())}
          disabled={busy || missing}
          aria-busy={busy || undefined}
        >
          {busy ? <span className="tk-confirm-spin" aria-hidden /> : null}
          {confirmLabel}
        </button>
      </div>
    </>
  );
}

/**
 * The site's own confirm box, used instead of the browser's confirm() and prompt() pop-ups.
 * It sits above the chat pop-up and drawers, closes on Esc or a click outside, and starts with focus on Cancel
 * (or on the text box when it has one), so Enter does not confirm a delete by accident.
 */
export function ConfirmDialog(props: Props) {
  const { open, onCancel, ...rest } = props;
  return (
    <Dialog open={open} title={props.title} onClose={onCancel} align="center" raised narrow>
      <Body {...rest} onCancel={onCancel} />
    </Dialog>
  );
}
