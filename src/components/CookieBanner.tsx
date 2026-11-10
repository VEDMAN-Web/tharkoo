"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUrlPaths } from "./UrlPaths";

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
  const path = usePathname() || "/";
  const paths = useUrlPaths();
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
  const onAd = path.startsWith(`/${paths.ad}/`);
  return (
    <div className={`tk-cookie ${onAd ? "on-ad" : ""}`}>
      <p>
        {body || "We use cookies to keep the site reliable and remember your choices."}{" "}
        <Link href={noticeHref}>{notice}</Link>
      </p>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          type="button"
          className="tk-btn tk-btn-rose tk-btn-sm"
          onClick={() => {
            localStorage.setItem("nl-cookies", "all");
            setOpen(false);
          }}
        >
          {accept}
        </button>
        <button
          type="button"
          className="tk-btn tk-btn-outline-rose"
          onClick={() => {
            localStorage.setItem("nl-cookies", "necessary");
            setOpen(false);
          }}
        >
          {necessary}
        </button>
      </div>
    </div>
  );
}
