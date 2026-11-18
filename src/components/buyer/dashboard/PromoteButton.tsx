"use client";

import type { ReactNode } from "react";
import { openPromote } from "@/components/promote/openPromote";

/** H14.3: a button that opens the promote sheet for one ad, with a plan chosen when the dashboard knows one. */
export function PromoteButton({ listingId, title, planId, className, children }: { listingId: string; title: string; planId?: string | null; className: string; children: ReactNode }) {
  return (
    <button type="button" className={className} data-tk="dash-promote" onClick={() => openPromote({ listingId, title, ...(planId ? { planId } : {}) })}>
      {children}
    </button>
  );
}
