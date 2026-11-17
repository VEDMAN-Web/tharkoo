"use client";

import { useEffect, useId, useRef } from "react";
import { ChevronLeft, X } from "lucide-react";
import "@/styles/admin-kit.css";

const FOCUSABLE = "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])";

/**
 * The right-hand drawer (UI-RULES section 5): 420 px (460 px for users, ID checks, cities), full screen under 600 px with a Back button.
 * Header: title, sub line, Close. Footer comes from the caller: Cancel left, primary right. Esc closes; Tab stays inside; focus goes back to the trigger.
 * Never open a drawer on top of another drawer.
 */
export function Drawer({
  open,
  title,
  subtitle,
  size = "md",
  onClose,
  footer,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  size?: "md" | "lg";
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const visible = () => Array.from(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((node) => node.getClientRects().length > 0);
    visible()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      // A confirm dialog opened from the drawer handles its own Esc: the drawer stays.
      if (event.key === "Escape" && document.querySelector("[data-tk=reason-dialog]")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel.current) return;
      const items = visible();
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
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
    <aside ref={panel} className={`adm-k adm-k-drawer${size === "lg" ? " adm-k-drawer-lg" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId} data-tk="drawer">
      <div className="adm-k-dh">
        <button type="button" className="adm-k-btn adm-k-btn-quiet adm-k-dback" onClick={onClose} aria-label="Back" title="Back">
          <ChevronLeft aria-hidden="true" focusable="false" />
          Back
        </button>
        <div className="adm-k-dh-text">
          <h2 id={titleId}>{title}</h2>
          {subtitle ? <small>{subtitle}</small> : null}
        </div>
        <button type="button" className="adm-k-btn adm-k-btn-sm adm-k-btn-icon adm-k-dclose" onClick={onClose} aria-label="Close" title="Close">
          <X aria-hidden="true" focusable="false" />
        </button>
      </div>
      <div className="adm-k-db">{children}</div>
      {footer ? <div className="adm-k-df">{footer}</div> : null}
    </aside>
  );
}
