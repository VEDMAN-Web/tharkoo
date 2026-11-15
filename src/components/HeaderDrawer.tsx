"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useState } from "react";
import { useFocusTrap } from "./ui/useFocusTrap";
import { CountryList } from "./HeaderCountry";
import { useSiteCountry } from "./SiteCountry";
import type { CountryOption } from "@/server/locations/country-scope";
import { ShellGlyph } from "./HeaderIcons";
import { safeHref } from "@/lib/sanitize";
import { applyPrefixes, loginPath, postAdPath } from "@/lib/urls";
import type { ShellLink } from "@/server/site-links/shell-config-rules";
import type { UrlPaths } from "@/lib/urls";
import { isProbablySignedIn, openSignInFromLink } from "./auth/SignInSheet";


/**
 * H7.1: the right-hand menu under 1024 px. 340 px wide (90vw at most), glass, focus trapped, Escape closes.
 * Log in and Post your ad sit at the bottom, as in the mockup.
 */
export function HeaderDrawer({
  links,
  countries,
  loginLabel,
  postLabel,
  paths,
  onClose,
}: {
  links: ShellLink[];
  countries: CountryOption[];
  loginLabel: string;
  postLabel: string;
  paths: UrlPaths;
  onClose: () => void;
}) {
  const [countryOpen, setCountryOpen] = useState(false);
  const siteCountry = useSiteCountry(countries);
  const ref = useFocusTrap<HTMLElement>(true, onClose);
  const visible = links.filter((item) => item.visible && safeHref(item.href));
  return (
    <div className="tkn-drawer-back" onClick={onClose}>
      <aside
        className="tkn-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        ref={ref}
        data-tk="drawer"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="tkn-drawer-head">
          <span className="tkn-drawer-title">Menu</span>
          <button type="button" className="tkn-icon-btn" aria-label="Close menu" onClick={onClose}>
            <X size={22} aria-hidden="true" focusable="false" />
          </button>
        </div>
        <nav aria-label="Main menu" className="tkn-drawer-nav">
          {visible.map((item) => (
            <Link key={item.href + item.label} href={applyPrefixes(safeHref(item.href), paths)} className="tkn-drawer-row" onClick={onClose}>
              <ShellGlyph icon={item.icon} />
              <span>{item.label}</span>
            </Link>
          ))}
          <button type="button" className="tkn-drawer-row" aria-expanded={countryOpen} onClick={() => setCountryOpen((v) => !v)}>
            <ShellGlyph icon="pin" />
            <span>Your country{siteCountry ? `: ${siteCountry.name}` : ""}</span>
          </button>
          {countryOpen ? <CountryList countries={countries} onPick={onClose} /> : null}
        </nav>
        <div className="tkn-drawer-foot">
          <Link
            href={loginPath(paths)}
            className="tkn-btn tkn-btn-ghost"
            onClick={(event) => {
              onClose();
              openSignInFromLink(event, "user");
            }}
          >
            {loginLabel}
          </Link>
          <Link
            href={postAdPath(paths)}
            className="tkn-btn tkn-btn-primary"
            prefetch={false}
            onClick={(event) => {
              onClose();
              if (!isProbablySignedIn()) openSignInFromLink(event, "seller", postAdPath(paths));
            }}
          >
            {postLabel}
          </Link>
        </div>
      </aside>
    </div>
  );
}
