"use client";

import Link from "next/link";
import { useState } from "react";
import { SearchModal } from "./SearchModal";
import { Logo } from "./Logo";

type Cat = { slug: string; name: string };
type City = { slug: string; name: string; stateSlug?: string };

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607z" />
  </svg>
);

const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path
      fillRule="evenodd"
      d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z"
      clipRule="evenodd"
    />
  </svg>
);

const MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24" aria-hidden>
    <path
      fillRule="evenodd"
      d="M3 5.25a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 5.25zm0 4.5A.75.75 0 013.75 9h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 9.75zm0 4.5a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75a.75.75 0 01-.75-.75zm0 4.5a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75a.75.75 0 01-.75-.75z"
      clipRule="evenodd"
    />
  </svg>
);

export function Header({
  siteName,
  countryName,
  categories,
  cities,
  searchPlaceholder,
  postCta,
}: {
  siteName: string;
  countryName: string;
  categories: Cat[];
  cities: City[];
  searchPlaceholder: string;
  postCta: string;
}) {
  const [search, setSearch] = useState(false);
  const [menu, setMenu] = useState(false);
  const [drawer, setDrawer] = useState(false);

  return (
    <>
      <header id="main-header">
        <div className="sk-container">
          <div className="sk-nav">
            <Logo name={siteName} country={countryName} />
            <div className="sk-nav-actions">
              <button type="button" className="sk-icon-btn" aria-label="Search" onClick={() => setSearch(true)}>
                <SearchIcon />
              </button>
              <div className="relative">
                <button type="button" className="sk-icon-btn" aria-label="Account" onClick={() => setMenu((v) => !v)}>
                  <UserIcon />
                </button>
                {menu ? (
                  <div className="sk-account-menu">
                    {[
                      ["/u/login/", "Log in"],
                      ["/u/register/", "Register"],
                      ["/u/account/dashboard/", "Dashboard"],
                      ["/u/account/ads/", "Ads"],
                      ["/u/account/credits/", "Wallet"],
                      ["/u/account/media/", "Media"],
                      ["/u/logout/", "Log out"],
                    ].map(([href, label]) => (
                      <Link key={href} href={href} onClick={() => setMenu(false)}>
                        {label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
              <button type="button" className="sk-icon-btn lg-hide" aria-label="Menu" onClick={() => setDrawer(true)}>
                <MenuIcon />
              </button>
              <Link href="/u/post-insert/" className="btn-post sm-hide">
                {postCta}
              </Link>
            </div>
          </div>
        </div>
      </header>
      {drawer ? (
        <div className="sk-drawer">
          <button type="button" className="sk-drawer-close" aria-label="Close" onClick={() => setDrawer(false)}>
            ×
          </button>
          <p className="sk-drawer-label">Publish ad</p>
          <Link href="/u/post-insert/" className="btn-post btn-block" onClick={() => setDrawer(false)}>
            {postCta}
          </Link>
          <p className="sk-drawer-label">Services for you!</p>
          <Link href="/blog/" onClick={() => setDrawer(false)}>
            Blog
          </Link>
          <Link href="/help/" onClick={() => setDrawer(false)}>
            Help Center
          </Link>
        </div>
      ) : null}
      {search ? (
        <SearchModal
          brand={siteName}
          placeholder={searchPlaceholder}
          categories={categories}
          cities={cities}
          onClose={() => setSearch(false)}
        />
      ) : null}
    </>
  );
}
