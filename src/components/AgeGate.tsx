"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { useFocusTrap } from "./ui/useFocusTrap";

const AGE_LINK_CSS = ".tk-age .tk-age-terms { display: inline; box-decoration-break: clone; -webkit-box-decoration-break: clone; } .tk-age .tk-age-terms:focus-visible { outline: 2px solid #7c3aed; outline-offset: 2px; border-radius: 2px; }";

export function AgeGate({
  title = "Please confirm your age before continuing",
  lead = "I am over 18 years old",
  rest = "and I accept the terms of use of this site.",
  terms = "Terms and Conditions",
  yes = "I am 18 or older, enter",
  no = "Decline",
  noHref = "https://www.google.com",
}: {
  brand?: string;
  title?: string;
  body?: string;
  lead?: string;
  rest?: string;
  terms?: string;
  yes?: string;
  no?: string;
  noHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useFocusTrap(open, () => {});
  const acceptRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) acceptRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (localStorage.getItem("nl-age") === "ok") {
        window.dispatchEvent(new Event("tk-age-ok"));
        return;
      }
      setOpen(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  if (!open) return null;
  return (
    <div className="tk-age-back" style={{ backdropFilter: "blur(8px)", background: "rgba(74, 33, 58, 0.35)" }}>
      <style>{AGE_LINK_CSS}</style>
      <div className="tk-age" data-tk="age-gate" role="dialog" aria-modal="true" aria-labelledby="age-title" ref={ref}>
        <div className="tk-age-icon" aria-hidden>
          <Users size={22} color="#A8124F" />
          <span className="tk-age-pill">18+</span>
        </div>
        <h2 id="age-title" style={{ fontWeight: 600 }}>
          {title}
        </h2>
        <p>
          <strong>{lead}</strong> {rest}
        </p>
        <p>
          I have read and accept the <Link href="/terms/" className="tk-age-terms">
            {terms}
          </Link>
        </p>
        <button
          ref={acceptRef}
          type="button"
          className="tk-btn tk-btn-cta"
          data-tk="age-accept"
          style={{ minWidth: 100, height: 45, padding: "0 24px", margin: "12px auto 0", whiteSpace: "nowrap" }}
          onClick={() => {
            localStorage.setItem("nl-age", "ok");
            window.dispatchEvent(new Event("tk-age-ok"));
            setOpen(false);
          }}
        >
          {yes}
        </button>
        <p>
          <a href={noHref} style={{ color: "var(--accent)", display: "inline-block", minHeight: 24, padding: "4px 8px" }}>
            {no || "Decline"}
          </a>
        </p>
      </div>
    </div>
  );
}
