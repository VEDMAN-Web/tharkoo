"use client";

import { useEffect, useState } from "react";

export function AgeGate() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(localStorage.getItem("nl-age") !== "ok");
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          Age confirmation
        </p>
        <h2 className="mt-2 text-xl font-semibold">Are you 18 or older?</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          This classifieds board may include listings meant for adults. Confirm your age to continue.
          You can change category names later; the gate stays admin-configurable.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            className="flex-1 rounded bg-[var(--brand-accent)] px-4 py-2.5 text-sm font-semibold text-white"
            onClick={() => {
              localStorage.setItem("nl-age", "ok");
              setOpen(false);
            }}
          >
            I am 18 or older
          </button>
          <a
            className="flex-1 rounded border border-gray-300 px-4 py-2.5 text-center text-sm font-semibold"
            href="https://www.google.com"
          >
            Leave
          </a>
        </div>
        <p className="mt-3 text-xs text-[var(--text-secondary)]">
          By entering you also agree to the <a className="underline" href="/terms">Terms</a>.
        </p>
      </div>
    </div>
  );
}
