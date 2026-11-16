"use client";

import { useEffect, useRef, useState } from "react";

export function ReadMoreText({ text, more, less }: { text: string; more: string; less: string }) {
  const body = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [clamped, setClamped] = useState(false);

  useEffect(() => {
    const el = body.current;
    if (!el) return;
    const measure = () => {
      if (!open) setClamped(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [text, open]);

  return (
    <>
      <p ref={body} className={open ? "tkn-ad-text" : "tkn-ad-text is-clamped"} data-tk="ad-text">
        {text}
      </p>
      {clamped || open ? (
        <button type="button" className="tkn-readmore" aria-expanded={open} data-tk="read-more" onClick={() => setOpen((value) => !value)}>
          {open ? less : more}
        </button>
      ) : null}
    </>
  );
}
