"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function Dialog({
  open,
  title,
  onClose,
  children,
  sheet = false,
  scrim = true,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  sheet?: boolean;
  scrim?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    previous.current = document.activeElement as HTMLElement | null;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    const node = ref.current;
    const focusable = () =>
      Array.from(node?.querySelectorAll<HTMLElement>("a,button,input,select,textarea,[tabindex]:not([tabindex='-1'])") || []).filter(
        (el) => !el.hasAttribute("disabled"),
      );
    focusable()[0]?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      previous.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  const node = (
    <div
      className={
        scrim
          ? "fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
          : "fixed inset-x-0 bottom-0 z-50 p-3 sm:inset-0 sm:flex sm:items-end sm:justify-center sm:bg-transparent"
      }
      onMouseDown={scrim ? onClose : undefined}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={
          sheet
            ? "max-h-[92vh] w-full overflow-auto rounded-t-xl border border-line bg-raised p-4 shadow-lg sm:max-w-lg sm:rounded-xl"
            : "max-h-[92vh] w-full overflow-auto rounded-xl border border-line bg-raised p-4 shadow-lg sm:max-w-xl"
        }
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
  if (!mounted) return node;
  return createPortal(node, document.body);
}
