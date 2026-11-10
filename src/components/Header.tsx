"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Search, User, X, MessageCircle, CircleHelp } from "lucide-react";
import { Logo } from "./Logo";
import { SearchModal } from "./SearchModal";
import { useCity } from "./CityContext";
import { useFocusTrap } from "./ui/useFocusTrap";
import { api, hasSessionHint, isStaffRole } from "@/lib/ui/api";
import { safeHref } from "@/lib/sanitize";

type Cat = { slug: string; name: string };
type City = { slug: string; name: string; stateSlug?: string };
type Social = { label: string; href: string };

export function Header({
  siteName,
  countryName,
  categories,
  cities,
  user = null,
  social = [],
}: {
  siteName: string;
  countryName: string;
  categories: Cat[];
  cities: City[];
  searchPlaceholder?: string;
  postCta?: string;
  user?: { email: string; roles: string[] } | null;
  social?: Social[];
}) {
  const path = usePathname() || "/";
  const { city } = useCity();
  const [search, setSearch] = useState(false);
  const [menu, setMenu] = useState(false);
  const [account, setAccount] = useState(false);
  const [who, setWho] = useState("");
  const homeLike = path === "/" || path.startsWith("/cities");
  const vendor = path.startsWith("/u/");
  const showCity = Boolean(city) && (path.startsWith("/ad/") || categories.some((cat) => path.startsWith(`/${cat.slug}`)));
  const drawerRef = useFocusTrap(menu, () => setMenu(false));

  useEffect(() => {
    function open() {
      setSearch(true);
    }
    window.addEventListener("tk-open-search", open);
    return () => window.removeEventListener("tk-open-search", open);
  }, []);

  useEffect(() => {
    if (!vendor || !hasSessionHint()) return;
    const id = window.setTimeout(() => {
      api<{ user: { displayName?: string; email?: string } }>("/api/auth/me").then((res) => {
        if (res.ok) setWho(res.data.user.displayName || res.data.user.email || "");
      });
    }, 0);
    return () => window.clearTimeout(id);
  }, [vendor]);

  const socials = social.filter((item) => item.href && safeHref(item.href) && !/google\.com\/search/i.test(item.href));
  const short = who.length > 10 ? `${who.slice(0, 10)}…` : who;

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
            <div className="tk-account">
              <button type="button" className="tk-icon-btn" aria-label="Account" aria-expanded={account} onClick={() => setAccount((v) => !v)}>
                <User size={20} fill="currentColor" />
              </button>
              {vendor && short ? <span className="tk-account-name">{short}</span> : null}
              {account ? (
                <div className="tk-menu" role="menu">
                  {user ? (
                    <>
                      <Link href="/u/account/dashboard/" onClick={() => setAccount(false)}>Dashboard</Link>
                      <Link href="/u/account/ads/" onClick={() => setAccount(false)}>Your ads</Link>
                      <Link href="/u/account/credits/" onClick={() => setAccount(false)}>Wallet</Link>
                      <Link href="/u/account/edit-account/" onClick={() => setAccount(false)}>Settings</Link>
                      {isStaffRole(user.roles) ? <Link href="/admin/" onClick={() => setAccount(false)}>Admin</Link> : null}
                      <Link href="/u/logout/" onClick={() => setAccount(false)}>Log out</Link>
                    </>
                  ) : (
                    <>
                      <Link href="/u/login/" onClick={() => setAccount(false)}>Log in</Link>
                      <Link href="/u/register/" onClick={() => setAccount(false)}>Register</Link>
                    </>
                  )}
                </div>
              ) : null}
            </div>
            <Link href="/u/post-insert/" data-tk="post-ad" className="tk-btn tk-btn-primary tk-post-desktop" prefetch={false}>
              POST YOUR AD
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
            <p className="tk-drawer-label">Publish ad</p>
            <Link href="/u/post-insert/" data-tk="post-ad" className="tk-btn tk-btn-primary" prefetch={false} onClick={() => setMenu(false)}>
              POST YOUR AD
            </Link>
            <p className="tk-drawer-label">Services for you!</p>
            <Link href="/blog/" className="tk-drawer-row" prefetch={false} onClick={() => setMenu(false)}>
              <MessageCircle size={24} /> Tharkoo Blog
            </Link>
            <Link href="/help/" className="tk-drawer-row" prefetch={false} onClick={() => setMenu(false)}>
              <CircleHelp size={24} /> Help Center
            </Link>
            {socials.length ? (
              <>
                <p className="tk-drawer-label">Follow us</p>
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
      {search ? <SearchModal categories={categories} cities={cities} onClose={() => setSearch(false)} /> : null}
    </>
  );
}
