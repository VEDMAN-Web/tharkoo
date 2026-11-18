"use client";

import { useCallback, useEffect, useRef, useState, type FocusEvent, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

const LEAVE_DELAY_MS = 140;
const FINE_POINTER = "(hover: hover) and (pointer: fine)";

/**
 * The hover pop-out of an ad card, shared by the Home card and the listing row card.
 * A mouse over the card (or keyboard focus) opens it after `delayMs`; leaving the card and the pop-out, Esc, a scroll
 * or a resize close it. Never on a touch screen, and not below `minWidth`. `anchor` is the box of the card while the pop-out is open.
 */
export function useCardHover(cardRef: RefObject<HTMLElement | null>, delayMs: number, minWidth = 0) {
  const showTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const over = useRef({ card: false, pop: false });
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  const clearTimers = useCallback(() => {
    if (showTimer.current !== null) window.clearTimeout(showTimer.current);
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    showTimer.current = null;
    hideTimer.current = null;
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const open = useCallback(() => {
    if (!window.matchMedia(FINE_POINTER).matches || window.innerWidth < minWidth) return;
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    if (showTimer.current !== null || anchor) return;
    showTimer.current = window.setTimeout(() => {
      showTimer.current = null;
      if (cardRef.current) setAnchor(cardRef.current.getBoundingClientRect());
    }, delayMs);
  }, [anchor, cardRef, delayMs, minWidth]);

  const close = useCallback(() => {
    if (showTimer.current !== null) window.clearTimeout(showTimer.current);
    showTimer.current = null;
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      hideTimer.current = null;
      if (!over.current.card && !over.current.pop) setAnchor(null);
    }, LEAVE_DELAY_MS);
  }, []);

  useEffect(() => {
    if (!anchor) return;
    const hide = () => {
      over.current = { card: false, pop: false };
      setAnchor(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };
    window.addEventListener("scroll", hide, { passive: true });
    window.addEventListener("resize", hide);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", hide);
      window.removeEventListener("resize", hide);
      document.removeEventListener("keydown", onKey);
    };
  }, [anchor]);

  const cardHandlers = {
    onPointerEnter(event: ReactPointerEvent) {
      if (event.pointerType !== "mouse") return;
      over.current.card = true;
      open();
    },
    onPointerLeave(event: ReactPointerEvent) {
      if (event.pointerType !== "mouse") return;
      over.current.card = false;
      close();
    },
    onFocus(event: FocusEvent<HTMLElement>) {
      if (event.target instanceof Element && event.target.matches(":focus-visible")) {
        over.current.card = true;
        open();
      }
    },
    onBlur(event: FocusEvent<HTMLElement>) {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        over.current.card = false;
        close();
      }
    },
  };

  const popHandlers = {
    onEnter() {
      over.current.pop = true;
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    },
    onLeave() {
      over.current.pop = false;
      close();
    },
  };

  return { anchor, cardHandlers, popHandlers };
}
