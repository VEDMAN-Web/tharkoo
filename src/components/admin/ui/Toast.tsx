"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import "@/styles/admin-kit.css";
import { toastDuration, toastRemaining } from "./kit-helpers";
import { ToastCard, type ToastView } from "./UndoToast";

type Ctx = { show: (toast: ToastView) => void; close: () => void };
const ToastCtx = createContext<Ctx | null>(null);
const TICK_MS = 200;

/**
 * Toasts: bottom left of the content area, one at a time, a newer one replaces the older.
 * The timer pauses while the toast is hovered or has focus. Wrap the admin shell (or a screen) once.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastView | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);
  const paused = useRef(false);
  const duration = toast ? toastDuration(toast.kind) : null;

  const close = useCallback(() => setToast(null), []);
  const show = useCallback((next: ToastView) => {
    paused.current = false;
    elapsedRef.current = 0;
    setElapsed(0);
    setToast(next);
  }, []);

  useEffect(() => {
    if (!toast || duration === null) return;
    const timer = window.setInterval(() => {
      if (paused.current) return;
      elapsedRef.current += TICK_MS;
      setElapsed(elapsedRef.current);
      if (elapsedRef.current >= duration) setToast(null);
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [toast, duration]);

  const remaining = toast ? toastRemaining(duration, elapsed) : null;
  const value = useMemo(() => ({ show, close }), [show, close]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="adm-k adm-k-dock" data-tk="toast-dock">
        {toast ? (
          <ToastCard
            toast={toast}
            remainingMs={remaining}
            onClose={close}
            onPause={() => {
              paused.current = true;
            }}
            onResume={() => {
              paused.current = false;
            }}
          />
        ) : null}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): Ctx {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast needs a ToastProvider");
  return ctx;
}
