"use client";

import { useEffect } from "react";

/**
 * H12.4 13: when a success toast appears in the admin, the open row (the one just saved) flashes a soft highlight once.
 * Only a class is added and removed; the highlight itself is a fading overlay in admin-kit.css, and it is off with reduced motion.
 */
export function RowFlash() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const flashed = new WeakSet<Element>();
    const check = () => {
      const toast = document.querySelector(".adm-k-toast:not(.adm-k-toast-err)");
      if (!toast || flashed.has(toast)) return;
      flashed.add(toast);
      const row = document.querySelector<HTMLElement>('tr[data-open="yes"]');
      if (!row) return;
      row.classList.add("adm-k-flash");
      window.setTimeout(() => row.classList.remove("adm-k-flash"), 700);
    };
    const mutations = new MutationObserver(check);
    mutations.observe(document.body, { childList: true, subtree: true });
    return () => mutations.disconnect();
  }, []);
  return null;
}
