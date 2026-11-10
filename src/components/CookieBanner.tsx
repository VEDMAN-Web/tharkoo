"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function CookieBanner({ body }: { body?: string; accept?: string; necessary?: string }) {
  const path = usePathname() || "/";
  const [open, setOpen] = useState(false);
  useEffect(() => {
    function maybe() {
      if (localStorage.getItem("nl-age") !== "ok") return;
      if (!localStorage.getItem("nl-cookies")) setOpen(true);
    }
    const id = window.setTimeout(maybe, 0);
    window.addEventListener("tk-age-ok", maybe);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("tk-age-ok", maybe);
    };
  }, []);
  if (!open) return null;
  const onAd = path.startsWith("/ad/");
  return (
    <div className={`fixed z-40 w-full max-w-[420px] p-3 ${onAd ? "bottom-20" : "bottom-0"} left-0 lg:bottom-4 lg:left-4`}>
      <div className="rounded-xl border border-line bg-surface p-4 shadow-md">
        <p className="t-small text-muted">
          {body || "We use cookies to keep the site reliable and remember your choices."}{" "}
          <Link href="/cms/cookies/" className="text-gold">
            Cookie notice
          </Link>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="gold-btn"
            onClick={() => {
              localStorage.setItem("nl-cookies", "all");
              setOpen(false);
            }}
          >
            Accept all
          </button>
          <button
            type="button"
            className="quiet-btn"
            onClick={() => {
              localStorage.setItem("nl-cookies", "necessary");
              setOpen(false);
            }}
          >
            Only necessary
          </button>
        </div>
      </div>
    </div>
  );
}
