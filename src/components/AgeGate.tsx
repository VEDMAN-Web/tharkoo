"use client";

import { useEffect, useState } from "react";
import { Logo } from "./Logo";

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
    if (localStorage.getItem("nl-age") === "ok") setOpen(false);
  }, []);

  if (!open) return null;

  return (
    <div className="age-gate" data-testid="age-gate">
      <div className="age-card">
        <Logo name={brand} href={null} size="lg" />
        <h1>{title}</h1>
        <p className="body">{body}</p>
        <div className="age-actions">
          <button
            className="age-yes"
            onClick={() => {
              localStorage.setItem("nl-age", "ok");
              setOpen(false);
            }}
          >
            {yes}
          </button>
          <a className="age-no" href="https://www.google.com">
            {no}
          </a>
        </div>
        <p className="mt-5 text-[11px] text-[#888]">
          By entering you accept the <a href="/terms/">Terms of use</a>.
        </p>
      </div>
    </div>
  );
}
