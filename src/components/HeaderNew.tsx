"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { BrandLogo } from "./BrandLogo";
import { LOGO_LIGHT_DEFAULT } from "@/lib/brand";
import { useSitePath } from "@/components/useSitePath";
import { ChevronDown, Megaphone, Menu, Phone } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { HeaderCountry } from "./HeaderCountry";
import type { CountryOption } from "@/server/locations/country-scope";
import { HeaderDrawer } from "./HeaderDrawer";
import { isProbablySignedIn, openSignInFromLink } from "./auth/SignInSheet";
import { useUrlPaths } from "./UrlPaths";
import { safeHref } from "@/lib/sanitize";
import { makeT, type UiTextMap } from "@/lib/ui/text";
import { UtilityStrip } from "./new/UtilityStrip";
import { applyPrefixes, loginPath, postAdPath } from "@/lib/urls";
import type { ShellConfig } from "@/server/site-links/shell-config-rules";
import { LogoutButton } from "./auth/LogoutButton";
import { accountName } from "@/lib/account-name";
import { openRecharge } from "./recharge/openRecharge";
import { useMenuDismiss } from "./ui/use-menu-dismiss";
import { api } from "@/lib/ui/api";
import { isSignedInPhase, useAccount } from "./account/AccountContext";

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
  logo = LOGO_LIGHT_DEFAULT,
  shell,
  cities,
  countries,
  categories,
  texts,
}: {
  siteName: string;
  logo?: string;
  shell: ShellConfig;
  cities: City[];
  countries: CountryOption[];
  categories: Cat[];
  texts?: UiTextMap;
}) {
  const path = useSitePath();
  const t = makeT(texts);
  const paths = useUrlPaths();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { phase, user, balance, callBalance, balanceReady, unread } = useAccount();
  const signedIn = isSignedInPhase(phase);
  const accountLabel = user ? accountName(user.displayName, user.email || "") : "";
  const [accountOpen, setAccountOpen] = useState(false);
  // H19.3: the credit chip shows "Call credits: N \u00b7 Ad credits: N" on hover (desktop) and on tap (phone).
  const [coinTip, setCoinTip] = useState(false);
  // H19.5: the menu shows My ads and Earnings only to an account with an ad, and a badge for video call requests waiting for an answer.
  const [adCount, setAdCount] = useState(0);
  const [waitingCalls, setWaitingCalls] = useState(0);
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    void api<{ counts?: { all?: number } }>("/api/listings/?pageSize=1").then((res) => {
      if (live && res.ok) setAdCount(Number(res.data.counts?.all) || 0);
    });
    const check = () => {
      if (document.visibilityState === "hidden") return;
      void api<{ role: string; status: string }[]>("/api/tours").then((res) => {
        if (live && res.ok) setWaitingCalls(res.data.filter((row) => row.role === "advertiser" && row.status === "requested").length);
      });
    };
    check();
    const timer = window.setInterval(check, 20_000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [signedIn]);
  const coinRef = useRef<HTMLSpanElement>(null);
  const closeCoinTip = useCallback(() => setCoinTip(false), []);
  useMenuDismiss(coinTip, coinRef, closeCoinTip);
  const accountRef = useRef<HTMLDivElement>(null);
  const closeAccount = useCallback(() => setAccountOpen(false), []);
  useMenuDismiss(accountOpen, accountRef, closeAccount);
  const links = shell.header.navLinks.filter((item) => item.visible && safeHref(item.href));

  useEffect(() => {
    function open() {
      setSearchOpen(true);
    }
    window.addEventListener("tk-open-search", open);
    return () => window.removeEventListener("tk-open-search", open);
  }, []);

  const navRef = useRef<HTMLElement>(null);
  const placePill = useCallback((hit: Element | null) => {
    const nav = navRef.current;
    if (!nav) return;
    const target = hit ?? nav.querySelector(".tkn-nav-link[aria-current='page']");
    nav.querySelectorAll(".tkn-nav-link").forEach((link) => link.classList.toggle("is-under", link === target));
    nav.style.setProperty("--m-on", target ? "1" : "0");
    if (target instanceof HTMLElement) {
      nav.style.setProperty("--m-x", `${target.offsetLeft}px`);
      nav.style.setProperty("--m-w", `${target.offsetWidth}px`);
    }
  }, []);
  useEffect(() => placePill(null), [path, placePill]);

  // The drawer and search sit outside the header: the header has a backdrop filter, which would trap a fixed layer inside it.
  return (
    <>
    {path === "/" ? <UtilityStrip texts={texts} /> : null}
    <header className="tkn-header" data-tk="header">
      <div className="tkn-wrap tkn-header-row">
        <BrandLogo src={logo} name={siteName} height={40} priority />
        <nav
          aria-label={t("chrome.nav.main")}
          className="tkn-nav"
          ref={navRef}
          onPointerOver={(event) => {
            const link = event.target instanceof Element ? event.target.closest(".tkn-nav-link") : null;
            if (link) placePill(link);
          }}
          onPointerLeave={() => placePill(null)}
          onFocus={(event) => placePill(event.target instanceof Element ? event.target.closest(".tkn-nav-link") : null)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) placePill(null);
          }}
        >
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
          {signedIn ? (
            <>
              {balanceReady ? (
                balance !== null ? (
                  <span className="tkn-coin-wrap" ref={coinRef} data-open={coinTip ? "true" : undefined}>
                    <button type="button" className="tkn-coin-chip" data-tk="header-coins" aria-label={`${callBalance ?? 0} · ${balance}. ${t("panel.coins.chipLabel", { call: callBalance ?? 0, ad: balance })}`} aria-describedby="tkn-coin-tip" aria-expanded={coinTip} onClick={() => setCoinTip((open) => !open)}>
                      <Phone size={13} aria-hidden="true" focusable="false" /> {callBalance ?? 0}
                      <span className="tkn-coin-sep" aria-hidden="true">·</span>
                      <Megaphone size={13} aria-hidden="true" focusable="false" /> {balance}
                    </button>
                    <span id="tkn-coin-tip" role="tooltip" className="tkn-coin-tip" data-tk="header-coins-tip">
                      <span>{t("panel.coins.tooltip", { call: callBalance ?? 0, ad: balance })}</span>
                      <button type="button" className="tkn-coin-buy" data-tk="header-coins-buy" onClick={() => { setCoinTip(false); openRecharge({}); }}>
                        {t("panel.coins.buy")}
                      </button>
                    </span>
                  </span>
                ) : null
              ) : (
                <span className="tkn-coin-chip tkn-skel" data-tk="header-coins-wait" aria-hidden="true" />
              )}
              <div className="tkn-account" ref={accountRef}>
                <button
                  type="button"
                  className="tkn-avatar"
                  aria-label={(user ? t("chrome.account.menuFor", { name: accountLabel }) : t("chrome.account.menu")) + (unread > 0 ? `, ${unread} unread ${unread === 1 ? "chat message" : "chat messages"}` : "")}
                  aria-haspopup="menu"
                  aria-expanded={accountOpen}
                  data-tk="header-avatar"
                  onClick={() => setAccountOpen((open) => !open)}
                >
                  {user ? <span className="tkn-avatar-circle">{accountLabel.slice(0, 1).toUpperCase()}</span> : <span className="tkn-avatar-circle tkn-skel" aria-hidden="true" />}
                  <ChevronDown size={12} aria-hidden="true" focusable="false" />
                </button>
                {unread + waitingCalls > 0 ? <span className="tkn-avatar-dot" data-tk="header-unread" aria-hidden="true">{unread + waitingCalls > 9 ? "9+" : unread + waitingCalls}</span> : null}
                {accountOpen ? (
                  <div className="tkn-account-menu" role="menu">
                    {balance !== null ? (
                      <Link role="menuitem" href="/u/account/credits/" className="tkn-account-coins" onClick={() => setAccountOpen(false)}>
                        {t("panel.coins.callBalance", { count: callBalance ?? 0 })} · {t("panel.coins.adBalance", { count: balance })}
                      </Link>
                    ) : null}
                    <Link role="menuitem" href="/u/account/" onClick={() => setAccountOpen(false)}>{t("chrome.account.my")}</Link>
                    {adCount > 0 ? <Link role="menuitem" href="/u/account/ads/" onClick={() => setAccountOpen(false)}>{t("chrome.account.ads")}</Link> : null}
                    <Link role="menuitem" href="/u/account/messages/" onClick={() => setAccountOpen(false)}>{t("chrome.account.chats")}{unread > 0 ? <span className="tkn-menu-badge" data-tk="menu-unread">{unread}</span> : null}</Link>
                    <Link role="menuitem" href="/u/account/calls/" onClick={() => setAccountOpen(false)}>Video calls{waitingCalls > 0 ? <span className="tkn-menu-badge" data-tk="menu-calls">{waitingCalls}</span> : null}</Link>
                    <Link role="menuitem" href="/u/account/saved/" onClick={() => setAccountOpen(false)}>{t("chrome.account.saved")}</Link>
                    <Link role="menuitem" href="/u/account/credits/" onClick={() => setAccountOpen(false)}>{t("panel.menu.coins")}</Link>
                    {adCount > 0 ? <Link role="menuitem" href="/u/account/wallet/?tab=earnings" onClick={() => setAccountOpen(false)}>Earnings</Link> : null}
                    <Link role="menuitem" href="/u/account/support/" onClick={() => setAccountOpen(false)}>{t("chrome.account.help")}</Link>
                    <Link role="menuitem" href="/u/account/edit-account/" onClick={() => setAccountOpen(false)}>{t("chrome.account.settings")}</Link>
                    <LogoutButton role="menuitem" onClick={() => setAccountOpen(false)}>{t("chrome.account.logout")}</LogoutButton>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <Link href={loginPath(paths)} className="tkn-login-link tkn-hide-sm" onClick={(event) => openSignInFromLink(event)}>{shell.header.loginLabel}</Link>
          )}
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
            aria-label={t("chrome.menu.open")}
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
        signedIn={signedIn}
        paths={paths}
        t={t}
        onClose={() => setMenuOpen(false)}
      />
    ) : null}
    {searchOpen ? (
      <SearchModal categories={categories} cities={cities} onClose={() => setSearchOpen(false)} />
    ) : null}
    </>
  );
}
