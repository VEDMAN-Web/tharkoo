"use client";

import Link from "next/link";
import { creditsText, usePostingMoney } from "@/components/post/credits";
import { fillText } from "@/lib/ui/text";
import "./post-strip.css";

export function PostStrip({ text, button, feeText }: { text: string; button: string; feeText: string }) {
  const money = usePostingMoney();
  return (
    <aside className="tk-poststrip" data-tk="post-strip" aria-label={button}>
      <p className="tk-poststrip-text">
        {text}
        {money.paid ? <span data-tk="post-strip-fee"> {fillText(feeText, { fee: creditsText(money.fee) })}</span> : null}
      </p>
      <Link href="/u/post-insert/" className="tk-poststrip-btn" data-tk="post-strip-button">{button}</Link>
    </aside>
  );
}
