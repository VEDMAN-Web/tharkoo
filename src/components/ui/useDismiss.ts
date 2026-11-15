"use client";

import { useEffect, type RefObject } from "react";

/**
 * H7.4c: closes a menu, popover or sheet when a click or tap lands outside `ref`, or when Escape is pressed.
 * `ref` should wrap the trigger and the open panel, so a tap on the trigger is not "outside".
 */
export function useDismiss(open: boolean, ref: RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    function onPointer(event: Event) {
      const node = ref.current;
      if (node && event.target instanceof Node && !node.contains(event.target)) onClose();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, ref, onClose]);
}
