"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { HeaderCountry } from "./HeaderCountry";
import type { CountryOption } from "@/server/locations/country-scope";
import { HeaderDrawer } from "./HeaderDrawer";
import { isProbablySignedIn, openSignInFromLink } from "./auth/SignInSheet";
import { useUrlPaths } from "./UrlPaths";
import { safeHref } from "@/lib/sanitize";
import type { UiTextMap } from "@/lib/ui/text";
import { UtilityStrip } from "./new/UtilityStrip";
import { applyPrefixes, loginPath, postAdPath } from "@/lib/urls";
import type { ShellConfig } from "@/server/site-links/shell-config-rules";

// The search pop-up loads only when a visitor opens it, as in the old header.
const SearchModal = dynamic(() => import("./SearchModal").then((mod) => mod.SearchModal), { ssr: false });

type City = { slug: string; name: string; stateSlug?: string };
type Cat = { slug: string; name: string };

/**
 * H7.1: the header on every public page when the New design is on.
 * Logo, pill navigation, country pill, Log in, Post your ad. No search button, no saved or heart icon (P1, as the mockup).
 * Under 1024 px the pill navigation becomes a burger that opens the drawer.
 * The search pop-up still opens from the listing pages and the hero (the "tk-open-search" event).
 */
export function HeaderNew({
  siteName,
  shell,
  cities,
  countries,
  categories,
  texts,
}: {
  siteName: string;
  shell: ShellConfig;
  cities: City[];
  countries: CountryOption[];
  categories: Cat[];
  texts?: UiTextMap;
}) {
  const path = usePathname() || "/";
  const paths = useUrlPaths();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const links = shell.header.navLinks.filter((item) => item.visible && safeHref(item.href));

  useEffect(() => {
    function open() {
      setSearchOpen(true);
    }
    window.addEventListener("tk-open-search", open);
    return () => window.removeEventListener("tk-open-search", open);
  }, []);

  // The drawer and search sit outside the header: the header has a backdrop filter, which would trap a fixed layer inside it.
  return (
    <>
    {path === "/" ? <UtilityStrip texts={texts} /> : null}
    <header className="tkn-header" data-tk="header">
      <div className="tkn-wrap tkn-header-row">
        <Link href="/" className="tkn-brand">
          <span className="tkn-mark" aria-hidden="true">t</span>
          <span className="tkn-brand-text">
            <span className="tkn-brand-name">{siteName.toLowerCase()}</span>
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
          <HeaderCountry countries={countries} />
          <Link href={loginPath(paths)} className="tkn-login-link tkn-hide-sm" onClick={(event) => openSignInFromLink(event)}>{shell.header.loginLabel}</Link>
          <Link
            href={postAdPath(paths)}
            className="tkn-btn tkn-btn-primary"
            data-tk="post-ad"
            prefetch={false}
            onClick={(event) => {
              if (!isProbablySignedIn()) openSignInFromLink(event, postAdPath(paths));
            }}
          >
            <span className="tkn-post-long">{shell.header.postLabel}</span>
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
        countries={countries}
        loginLabel={shell.header.loginLabel}
        postLabel={shell.header.postLabel}
        paths={paths}
        onClose={() => setMenuOpen(false)}
      />
    ) : null}
    {searchOpen ? (
      <SearchModal categories={categories} cities={cities} onClose={() => setSearchOpen(false)} />
    ) : null}
    </>
  );
}
