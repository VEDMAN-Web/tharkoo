"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import "@/styles/admin-kit.css";
import { toastDuration, toastRemaining } from "./kit-helpers";
import { ToastCard, type ToastView } from "./UndoToast";

type Ctx = { show: (toast: ToastView) => void; close: () => void };
const ToastCtx = createContext<Ctx | null>(null);
const TICK_MS = 200;
const PHONE_MAX = 767;
const LIFT_GAP = 12;

/** On a phone an open drawer is full screen with a sticky footer. The toast sits just above that footer, not on top of its buttons. */
function footerLift(): number | null {
  if (window.innerWidth > PHONE_MAX) return null;
  const footer = document.querySelector<HTMLElement>(".adm-k-drawer .adm-k-df");
  if (!footer) return null;
  return Math.ceil(window.innerHeight - footer.getBoundingClientRect().top) + LIFT_GAP;
}

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
  const dock = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const node = dock.current;
    if (!node) return;
    const lift = toast ? footerLift() : null;
    if (lift === null) node.style.removeProperty("--adm-dock-lift");
    else node.style.setProperty("--adm-dock-lift", `${lift}px`);
  }, [toast]);

  const remaining = toast ? toastRemaining(duration, elapsed) : null;
  const value = useMemo(() => ({ show, close }), [show, close]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div ref={dock} className="adm-k adm-k-dock" data-tk="toast-dock">
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
