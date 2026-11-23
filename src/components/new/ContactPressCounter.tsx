"use client";

import type { ReactNode } from "react";
import { recordAdClick } from "@/components/ad/adCountStore";

const CONTACT_BUTTONS = '[data-tk="call"], [data-tk="whatsapp"], [data-tk="chat"], [data-tk="tour"]';

/**
 * H19.1: a click on an ad is a press of one of its contact buttons (call, WhatsApp, chat, video). The server counts one per visitor.
 * It wraps the contact buttons of the ad page without adding a box of its own.
 */
export function ContactPressCounter({ slug, children }: { slug: string; children: ReactNode }) {
  return (
    <div
      style={{ display: "contents" }}
      onClickCapture={(event) => {
        const hit = (event.target as Element | null)?.closest?.(CONTACT_BUTTONS);
        if (hit && slug) recordAdClick(slug);
      }}
    >
      {children}
    </div>
  );
}
