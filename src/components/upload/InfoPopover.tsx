"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import "./upload.css";

/**
 * H7.8: a small (i) button with a popover, optionally with a short visible label beside the i. Desktop hover opens it; click or tap pins it open.
 * Esc and an outside click close it. The popover is always in the page (hidden when closed) so the
 * field can point at it with aria-describedby.
 */
export function InfoPopover({ id, label, text, children }: { id: string; label: string; text?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const popId = `${id}-pop`;

  useEffect(() => {
    if (!open) return;
    function close(restoreFocus: boolean) {
      setOpen(false);
      setPinned(false);
      if (restoreFocus) button.current?.focus();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close(true);
    }
    function onPointer(event: PointerEvent) {
      if (wrap.current && !wrap.current.contains(event.target as Node)) close(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div className="upl-info-wrap" ref={wrap}>
      <button
        ref={button}
        type="button"
        className={text ? "upl-info upl-info-text" : "upl-info"}
        aria-label={text ? `${text}: ${label}` : `About ${label}`}
        aria-expanded={open}
        aria-controls={popId}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") setOpen(true);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse" && !pinned) setOpen(false);
        }}
        onClick={() => {
          if (open && pinned) {
            setOpen(false);
            setPinned(false);
          } else {
            setOpen(true);
            setPinned(true);
          }
        }}
      >
        {text ? <span className="upl-info-i" aria-hidden="true" /> : "i"}
        {text}
      </button>
      <div id={popId} role="note" className="upl-pop" hidden={!open}>
        {children}
      </div>
    </div>
  );
}
