"use client";

import { useEffect, type RefObject } from "react";

/** An ad card, a listing row and the pop-outs they open. The pointer reaching one of them closes an open menu. */
const AD_SURFACES = '[data-tk="home-ad"], [data-tk="listing-row"], [data-tk="card"], [data-tk="home-ad-popout"], [data-tk="listing-popout"]';

/**
 * Closes an open menu on a press anywhere else, on Escape, and when the pointer moves onto an ad card or its pop-out,
 * so the menu never sits over or under a pop-out.
 */
export function useMenuDismiss(open: boolean, root: RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => {
      const target = event.target as Element | null;
      if (target && root.current && !root.current.contains(target)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onOver = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest?.(AD_SURFACES)) close();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerover", onOver);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerover", onOver);
    };
  }, [open, root, close]);
}
