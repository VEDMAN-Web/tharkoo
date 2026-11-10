"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { useFocusTrap } from "./ui/useFocusTrap";

export function AgeGate({ no = "Decline" }: { brand?: string; title?: string; body?: string; yes?: string; no?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useFocusTrap(open, () => {});

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
      <div className="tk-age" data-tk="age-gate" role="dialog" aria-modal="true" aria-labelledby="age-title" ref={ref}>
        <div className="tk-age-icon" aria-hidden>
          <Users size={22} color="#6A2150" />
          <span className="tk-age-pill">18+</span>
        </div>
        <h2 id="age-title">Please confirm your age before continuing</h2>
        <p>
          <strong>I am over 18 years old</strong> and I accept the terms of use of this site.
        </p>
        <p>
          I have read and accept the <Link href="/terms/">Terms and Conditions</Link>
        </p>
        <button
          type="button"
          className="tk-btn tk-btn-rose"
          data-tk="age-accept"
          style={{ width: 100, height: 45, margin: "12px auto 0" }}
          onClick={() => {
            localStorage.setItem("nl-age", "ok");
            window.dispatchEvent(new Event("tk-age-ok"));
            setOpen(false);
          }}
        >
          ACCEPT
        </button>
        <p>
          <a href="https://www.google.com" style={{ color: "var(--accent)", display: "inline-block", minHeight: 24, padding: "4px 8px" }}>
            {no || "Decline"}
          </a>
        </p>
      </div>
    </div>
  );
}
