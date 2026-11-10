"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "./Logo";
import { safeHtml } from "@/lib/sanitize";

export function AgeGate({
  brand,
  title,
  body,
  yes,
  no,
}: {
  brand: string;
  title: string;
  body: string;
  yes: string;
  no: string;
}) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    // Browser storage is an external source and must be read after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (localStorage.getItem("nl-age") === "ok") setOpen(false);
  }, []);

  if (!open) return null;

  return (
    <div className="age-gate" data-testid="age-gate">
      <div className="age-card">
        <div className="age-18">
          <Logo name={brand} href={null} size="lg" />
          <span className="age-18-badge">18+</span>
        </div>
        <h2>{title || "Please read the following warning before continuing"}</h2>
        <p
          className="body"
          dangerouslySetInnerHTML={{
            __html: safeHtml(
              body.includes("<")
                ? body
                : " <b>I am over 18 years old</b>  and I accept the viewing of explicit texts and images intended for an <b>adult audience</b>.",
            ),
          }}
        />
        <p className="age-terms">
          I have read and accept the <Link href="/terms/">Terms and Conditions</Link>
        </p>
        <button
          className="age-yes"
          type="button"
          onClick={() => {
            localStorage.setItem("nl-age", "ok");
            setOpen(false);
          }}
        >
          {yes || "Accept"}
        </button>
        <a className="age-no" href="https://www.google.com">
          {no || "Decline"}
        </a>
      </div>
    </div>
  );
}
