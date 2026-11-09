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
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (localStorage.getItem("nl-cookies")) setOpen(false);
  }, []);

  if (!open) return null;

  return (
    <div className="cookie-bar" data-testid="cookie-banner">
      <div className="container-site flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] leading-5 text-[#555]">
          {body || "This website uses cookies. By continuing you accept our cookie policy."}{" "}
          <a href="/cookies/">cookie policy</a>.
        </p>
        <div className="flex gap-2">
          <button
            className="btn-post"
            onClick={() => {
              localStorage.setItem("nl-cookies", "all");
              setOpen(false);
            }}
          >
            {accept || "Accept all"}
          </button>
          <button
            className="btn-ghost"
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
