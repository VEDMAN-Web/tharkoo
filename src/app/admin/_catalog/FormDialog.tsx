"use client";

import { useEffect, useId, useRef } from "react";

const FOCUSABLE = "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])";

/**
 * A small dialog with a form inside (New category, Add sub-category, Edit sub-category). Esc closes it, Tab stays inside,
 * focus goes to the first field and comes back to the button that opened it. Buttons go in `footer`: Cancel left, the action right.
 */
export function FormDialog({ open, title, intro, onClose, children, footer }: { open: boolean; title: string; intro?: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const id = useId();

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("input,select,textarea,button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
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
  return (
    <div className="adm-k adm-k-scrim" onMouseDown={(event) => event.target === event.currentTarget && onClose()} data-tk="form-dialog-scrim">
      <div ref={panel} className="adm-k-dlg adm-cat-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} data-tk="form-dialog">
        <div className="adm-k-dlg-h">
          <h2 id={`${id}-t`}>{title}</h2>
        </div>
        <div className="adm-k-dlg-b">
          {intro ? <p className="adm-k-help">{intro}</p> : null}
          {children}
        </div>
        <div className="adm-k-dlg-f">{footer}</div>
      </div>
    </div>
  );
}
