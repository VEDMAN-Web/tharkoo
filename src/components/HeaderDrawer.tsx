"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useState } from "react";
import { useFocusTrap } from "./ui/useFocusTrap";
import { HeaderCityList } from "./HeaderCity";
import { ShellGlyph } from "./HeaderIcons";
import { safeHref } from "@/lib/sanitize";
import { applyPrefixes, loginPath, postAdPath } from "@/lib/urls";
import type { ShellLink } from "@/server/site-links/shell-config-rules";
import type { UrlPaths } from "@/lib/urls";

type City = { slug: string; name: string; stateSlug?: string };

/**
 * H7.1: the right-hand menu under 1024 px. 340 px wide (90vw at most), glass, focus trapped, Escape closes.
 * Log in and Post your ad sit at the bottom, as in the mockup.
 */
export function HeaderDrawer({
  links,
  cities,
  loginLabel,
  postLabel,
  paths,
  onClose,
}: {
  links: ShellLink[];
  cities: City[];
  loginLabel: string;
  postLabel: string;
  paths: UrlPaths;
  onClose: () => void;
}) {
  const [cityOpen, setCityOpen] = useState(false);
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
          <button type="button" className="tkn-drawer-row" aria-expanded={cityOpen} onClick={() => setCityOpen((v) => !v)}>
            <ShellGlyph icon="pin" />
            <span>Your city</span>
          </button>
          {cityOpen ? <HeaderCityList cities={cities} onPick={onClose} /> : null}
        </nav>
        <div className="tkn-drawer-foot">
          <Link href={loginPath(paths)} className="tkn-btn tkn-btn-ghost" onClick={onClose}>{loginLabel}</Link>
          <Link href={postAdPath(paths)} className="tkn-btn tkn-btn-primary" prefetch={false} onClick={onClose}>{postLabel}</Link>
        </div>
      </aside>
    </div>
  );
}
