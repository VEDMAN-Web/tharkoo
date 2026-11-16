"use client";

import { AlertTriangle, Check, Undo2, X } from "lucide-react";
import "@/styles/admin-kit.css";
import { countdownSeconds, type ToastKind } from "./kit-helpers";

export type ToastView = {
  kind: ToastKind;
  message: string;
  /** Undo toast: runs when Undo is pressed. */
  onUndo?: () => void;
  /** Error toast: "Try again". */
  onRetry?: () => void;
  /** An error can also offer the code to copy to support. */
};

/**
 * One toast (UI-RULES section 9). Undo: check icon, what happened, Undo, countdown, Close. Success: 4 s, no action.
 * Error: stays until closed, says what to do, role="alert". The others use role="status".
 */
export function ToastCard({
  toast,
  remainingMs,
  onClose,
  onPause,
  onResume,
}: {
  toast: ToastView;
  remainingMs: number | null;
  onClose: () => void;
  onPause: () => void;
  onResume: () => void;
}) {
  const error = toast.kind === "error";
  return (
    <div
      className={`adm-k-toast${error ? " adm-k-toast-err" : ""}`}
      role={error ? "alert" : "status"}
      data-tk="toast"
      data-kind={toast.kind}
      onMouseEnter={onPause}
      onMouseLeave={onResume}
      onFocus={onPause}
      onBlur={onResume}
    >
      {error ? <AlertTriangle className="adm-k-toast-ico" aria-hidden="true" focusable="false" /> : <Check className="adm-k-toast-ico" aria-hidden="true" focusable="false" />}
      <span className="adm-k-toast-msg">{toast.message}</span>
      {toast.kind === "undo" && toast.onUndo ? (
        <>
          <button type="button" className="adm-k-toast-btn" data-tk="toast-undo" onClick={toast.onUndo}>
            <Undo2 aria-hidden="true" focusable="false" />
            Undo
          </button>
          {remainingMs !== null ? <span className="adm-k-toast-time" data-tk="toast-count">{countdownSeconds(remainingMs)} s</span> : null}
        </>
      ) : null}
      {error && toast.onRetry ? (
        <button type="button" className="adm-k-toast-btn" data-tk="toast-retry" onClick={toast.onRetry}>
          Try again
        </button>
      ) : null}
      <button type="button" className="adm-k-toast-x" aria-label="Close" title="Close" data-tk="toast-close" onClick={onClose}>
        <X aria-hidden="true" focusable="false" />
      </button>
    </div>
  );
}
