"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { LayoutDashboard, List, LogOut, Menu, Search, Settings, ShieldCheck, User, Wallet, X, MessageCircle, CircleHelp } from "lucide-react";
import { Logo } from "./Logo";
// H6.7 perf: the search modal is only shown on demand, so its code loads on the first tap instead of on every page.
const SearchModal = dynamic(() => import("./SearchModal").then((mod) => mod.SearchModal), { ssr: false });
import { useCity } from "./CityContext";
import { useFocusTrap } from "./ui/useFocusTrap";
import { api, hasSessionHint, isStaffRole } from "@/lib/ui/api";
import { safeHref } from "@/lib/sanitize";
import { applyPrefixes, blogPath, helpPath, loginPath, postAdPath, registerPath } from "@/lib/urls";
import { useUrlPaths } from "./UrlPaths";

type Cat = { slug: string; name: string };
type City = { slug: string; name: string; stateSlug?: string };
type Social = { label: string; href: string; visible?: boolean };
type Chrome = {
  postLabel?: string;
  publishLabel?: string;
  servicesLabel?: string;
  followLabel?: string;
  searchModalPlaceholder?: string;
  searchSubmit?: string;
  drawer?: Social[];
};

export function Header({
  siteName,
  countryName,
  categories,
  cities,
  user = null,
  social = [],
  chrome,
}: {
  siteName: string;
  countryName: string;
  categories: Cat[];
  cities: City[];
  searchPlaceholder?: string;
  postCta?: string;
  user?: { email: string; roles: string[] } | null;
  social?: Social[];
  chrome?: Chrome;
}) {
  const path = usePathname() || "/";
  const paths = useUrlPaths();
  const { city } = useCity();
  const [search, setSearch] = useState(false);
  const [menu, setMenu] = useState(false);
  const [account, setAccount] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const [who, setWho] = useState("");
  const [session, setSession] = useState(user);
  const homeLike = path === "/" || path.startsWith(`/${paths.cities}`);
  const showCity = Boolean(city) && (path.startsWith(`/${paths.ad}/`) || categories.some((cat) => path.startsWith(`/${cat.slug}`)));
  const drawerRef = useFocusTrap(menu, () => setMenu(false));

  useEffect(() => {
    if (!account) return;
    function onDown(event: MouseEvent) {
      if (!accountRef.current?.contains(event.target as Node)) setAccount(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setAccount(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [account]);

  useEffect(() => {
    function open() {
      setSearch(true);
    }
    window.addEventListener("tk-open-search", open);
    return () => window.removeEventListener("tk-open-search", open);
  }, []);

  useEffect(() => {
    if (path.startsWith("/u/logout") || !hasSessionHint()) return;
    const id = window.setTimeout(() => {
      api<{ user: { displayName?: string; email?: string; roles?: string[] } }>("/api/auth/me").then((res) => {
        if (!res.ok) return;
        setWho(res.data.user.displayName || res.data.user.email || "");
        setSession({ email: res.data.user.email || "", roles: res.data.user.roles || [] });
      });
    }, 0);
    return () => window.clearTimeout(id);
  }, [path]);

  const socials = social.filter((item) => item.visible !== false && item.href && safeHref(item.href) && !/google\.com\/search/i.test(item.href));
  const postLabel = chrome?.postLabel || "POST YOUR AD";
  const drawer = (chrome?.drawer || [
    { label: "Tharkoo Blog", href: blogPath(paths) },
    { label: "Help Center", href: helpPath(paths) },
  ]).filter((item) => item.visible !== false && safeHref(item.href));

  return (
    <>
      <header className="tk-header" data-tk="header">
        <div className="tk-container tk-header-inner">
          <Logo name={siteName} country={countryName || "India"} city={showCity ? city : undefined} />
          <div className="ml-auto flex items-center">
            {homeLike ? (
              <button type="button" className="tk-icon-btn" aria-label="Search" onClick={() => setSearch(true)}>
                <Search size={24} />
              </button>
            ) : (
              <button type="button" className="tk-icon-btn tk-post-mobile" aria-label="Search" onClick={() => setSearch(true)}>
                <Search size={24} />
              </button>
            )}
            <div className="tk-account" ref={accountRef}>
              <button type="button" className="tk-icon-btn" aria-label="Account" aria-haspopup="menu" aria-expanded={account} onClick={() => setAccount((v) => !v)}>
                <User size={20} fill="currentColor" />
              </button>
              {account ? (
                <div className="tk-menu" role="menu">
                  {session ? (
                    <>
                      <div className="tk-menu-who">
                        <span className="tk-avatar" aria-hidden>{(who || session.email || "?").trim().charAt(0).toUpperCase()}</span>
                        <div>
                          <strong>{who || session.email}</strong>
                          <span>{session.email}</span>
                        </div>
                      </div>
                      <Link role="menuitem" className="tk-menu-row" href="/u/account/dashboard/" onClick={() => setAccount(false)}><LayoutDashboard size={18} aria-hidden />Dashboard</Link>
                      <Link role="menuitem" className="tk-menu-row" href="/u/account/ads/" onClick={() => setAccount(false)}><List size={18} aria-hidden />Your ads</Link>
                      <Link role="menuitem" className="tk-menu-row" href="/u/account/credits/" onClick={() => setAccount(false)}><Wallet size={18} aria-hidden />Wallet</Link>
                      <Link role="menuitem" className="tk-menu-row" href="/u/account/edit-account/" onClick={() => setAccount(false)}><Settings size={18} aria-hidden />Settings</Link>
                      {isStaffRole(session.roles) ? <Link role="menuitem" className="tk-menu-row" href="/admin/" onClick={() => setAccount(false)}><ShieldCheck size={18} aria-hidden />Admin</Link> : null}
                      <hr />
                      <Link role="menuitem" className="tk-menu-row tk-menu-out" href="/u/logout/" onClick={() => setAccount(false)}><LogOut size={18} aria-hidden />Log out</Link>
                    </>
                  ) : (
                    <div className="tk-menu-guest">
                      <p>Welcome to Tharkoo</p>
                      <Link role="menuitem" className="tk-btn tk-btn-primary" href={loginPath(paths)} onClick={() => setAccount(false)}>Log in</Link>
                      <Link role="menuitem" className="tk-btn tk-btn-outline-gold" href={registerPath(paths)} onClick={() => setAccount(false)}>Create account</Link>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            <Link href={postAdPath(paths)} data-tk="post-ad" className="tk-btn tk-btn-primary tk-post-desktop" prefetch={false}>
              {postLabel}
            </Link>
            <button type="button" className="tk-icon-btn tk-post-mobile" data-tk="menu-button" aria-label="Menu" onClick={() => setMenu(true)}>
              <Menu size={24} />
            </button>
          </div>
        </div>
      </header>
      {menu ? (
        <div className="tk-drawer-back" onClick={() => setMenu(false)}>
          <div
            className="tk-drawer"
            data-tk="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            ref={drawerRef}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="tk-drawer-x" aria-label="Close" onClick={() => setMenu(false)}>
              <X size={26} />
            </button>
            <p className="tk-drawer-label">{chrome?.publishLabel || "Publish ad"}</p>
            <Link href={postAdPath(paths)} data-tk="post-ad" className="tk-btn tk-btn-primary" prefetch={false} onClick={() => setMenu(false)}>
              {postLabel}
            </Link>
            <p className="tk-drawer-label">{chrome?.servicesLabel || "Services for you!"}</p>
            {drawer.map((item) => (
              <Link key={item.href + item.label} href={applyPrefixes(safeHref(item.href), paths)} className="tk-drawer-row" prefetch={false} onClick={() => setMenu(false)}>
                {item.href.startsWith("/blog") ? <MessageCircle size={24} /> : item.href.startsWith("/help") ? <CircleHelp size={24} /> : null}
                {item.label}
              </Link>
            ))}
            {socials.length ? (
              <>
                <p className="tk-drawer-label">{chrome?.followLabel || "Follow us"}</p>
                {socials.map((item) => (
                  <a key={item.label} className="tk-drawer-row" href={item.href} target="_blank" rel="noopener noreferrer">
                    {item.label}
                  </a>
                ))}
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      {search ? (
        <SearchModal
          categories={categories}
          cities={cities}
          placeholder={chrome?.searchModalPlaceholder}
          submitLabel={chrome?.searchSubmit}
          onClose={() => setSearch(false)}
        />
      ) : null}
    </>
  );
}
