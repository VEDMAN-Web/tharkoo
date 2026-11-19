"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CONSENT_EVENT, CONSENT_KEY } from "@/lib/analytics/ga";
import "./CookieBanner.css";

/** Saves the choice and tells the page (H17.11: the analytics tag loads only after Accept). */
function choose(value: "all" | "necessary") {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    /* a blocked store only means the notice shows again */
  }
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

export function CookieBanner({
  body,
  accept = "Accept all",
  necessary = "Only necessary",
  notice = "Cookie notice",
  noticeHref = "/cookies/",
}: {
  body?: string;
  accept?: string;
  necessary?: string;
  notice?: string;
  noticeHref?: string;
}) {
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
  return (
    <div className="tkc-banner">
      <p>
        {body || "We use cookies to keep the site reliable and remember your choices."}{" "}
        <Link href={noticeHref}>{notice}</Link>
      </p>
      <div className="tkc-actions">
        <button
          type="button"
          className="tkc-accept"
          onClick={() => {
            choose("all");
            setOpen(false);
          }}
        >
          {accept}
        </button>
        <button
          type="button"
          className="tkc-necessary"
          onClick={() => {
            choose("necessary");
            setOpen(false);
          }}
        >
          {necessary}
        </button>
      </div>
    </div>
  );
}
