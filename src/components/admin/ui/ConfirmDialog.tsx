"use client";

import { useEffect, useId, useState } from "react";

/** Type-to-confirm dialog for deletes: the confirm button stays off until `confirmText` is typed exactly. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmText,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmText: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open, onCancel]);

  if (!open) return null;
  const matches = typed === confirmText;
  return (
    <div className="adm-dialog-back" onClick={onCancel}>
      <div className="adm-dialog" role="alertdialog" aria-modal="true" aria-labelledby={`${id}-t`} onClick={(event) => event.stopPropagation()}>
        <h2 id={`${id}-t`}>{title}</h2>
        {body ? <p>{body}</p> : null}
        <label className="adm-field">
          <span className="adm-field-label">
            Type <strong>{confirmText}</strong> to confirm
          </span>
          <input className="adm-input" autoFocus value={typed} onChange={(event) => setTyped(event.target.value)} />
        </label>
        <div className="adm-dialog-actions">
          <button
            type="button"
            className="adm-btn adm-btn-quiet"
            onClick={() => {
              setTyped("");
              onCancel();
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="adm-btn adm-btn-danger"
            disabled={!matches}
            onClick={() => {
              setTyped("");
              onConfirm();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
