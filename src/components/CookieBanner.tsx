"use client";

import { useEffect, useState } from "react";

export function CookieBanner({
  body,
  accept,
  necessary,
}: {
  body?: string;
  accept?: string;
  necessary?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(!localStorage.getItem("nl-cookies"));
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-white p-4 shadow-[0_-4px_20px_rgba(0,0,0,.08)]">
      <div className="container-site flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--text-secondary)]">
          {body || "We use necessary cookies to run the site. Optional analytics stay off until you accept."}{" "}
          <a className="underline" href="/cookies/">
            cookie policy
          </a>
          .
        </p>
        <div className="flex gap-2">
          <button
            className="bg-[var(--sk-blue)] px-3 py-2 text-sm font-semibold text-white"
            onClick={() => {
              localStorage.setItem("nl-cookies", "all");
              setOpen(false);
            }}
          >
            {accept || "Accept all"}
          </button>
          <button
            className="border px-3 py-2 text-sm"
            onClick={() => {
              localStorage.setItem("nl-cookies", "necessary");
              setOpen(false);
            }}
          >
            {necessary || "Necessary only"}
          </button>
        </div>
      </div>
    </div>
  );
}
