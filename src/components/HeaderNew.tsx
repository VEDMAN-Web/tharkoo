"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useState } from "react";
import { HeaderCityButton, HeaderCityList } from "./HeaderCity";
import { HeaderDrawer } from "./HeaderDrawer";
import { useUrlPaths } from "./UrlPaths";
import { safeHref } from "@/lib/sanitize";
import { applyPrefixes, loginPath, postAdPath } from "@/lib/urls";
import type { ShellConfig } from "@/server/site-links/shell-config-rules";

type City = { slug: string; name: string; stateSlug?: string };

/**
 * H7.1: the header on every public page when the New design is on.
 * Logo, pill navigation, city picker, Log in, Post your ad. No saved or heart icon.
 * Under 1024 px the pill navigation becomes a burger that opens the drawer.
 */
export function HeaderNew({ siteName, shell, cities }: { siteName: string; shell: ShellConfig; cities: City[] }) {
  const path = usePathname() || "/";
  const paths = useUrlPaths();
  const [cityOpen, setCityOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const links = shell.header.navLinks.filter((item) => item.visible && safeHref(item.href));

  // The drawer sits outside the header: the header has a backdrop filter, which would trap a fixed drawer inside it.
  return (
    <>
    <header className="tkn-header" data-tk="header">
      <div className="tkn-wrap tkn-header-row">
        <Link href="/" className="tkn-brand">
          <span className="tkn-mark" aria-hidden="true">t</span>
          <span className="tkn-brand-text">
            <span className="tkn-brand-name">{siteName}</span>
            <span className="tkn-brand-tag">Free classifieds</span>
          </span>
        </Link>
        <nav aria-label="Main" className="tkn-nav">
          {links.map((item) => {
            const href = applyPrefixes(safeHref(item.href), paths);
            const current = path === safeHref(item.href);
            return (
              <Link key={item.href + item.label} href={href} className="tkn-nav-link" aria-current={current ? "page" : undefined}>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="tkn-header-actions">
          <div className="tkn-city-wrap">
            <HeaderCityButton expanded={cityOpen} onToggle={() => setCityOpen((v) => !v)} />
            {cityOpen ? (
              <div className="tkn-pop" role="group" aria-label="Cities">
                <HeaderCityList cities={cities} onPick={() => setCityOpen(false)} />
              </div>
            ) : null}
          </div>
          <Link href={loginPath(paths)} className="tkn-btn tkn-btn-ghost tkn-hide-sm">{shell.header.loginLabel}</Link>
          <Link href={postAdPath(paths)} className="tkn-btn tkn-btn-primary" data-tk="post-ad" prefetch={false}>
            {shell.header.postLabel}
          </Link>
          <button
            type="button"
            className="tkn-icon-btn tkn-burger"
            aria-label="Open menu"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            data-tk="menu-button"
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={20} aria-hidden="true" focusable="false" />
          </button>
        </div>
      </div>
    </header>
    {menuOpen ? (
      <HeaderDrawer
        links={shell.header.navLinks}
        cities={cities}
        loginLabel={shell.header.loginLabel}
        postLabel={shell.header.postLabel}
        paths={paths}
        onClose={() => setMenuOpen(false)}
      />
    ) : null}
    </>
  );
}
