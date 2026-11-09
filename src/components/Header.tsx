"use client";

import Link from "next/link";
import { ChevronDown, Search, User } from "lucide-react";
import { useState } from "react";
import { SearchModal } from "./SearchModal";
import { CityPicker } from "./CityPicker";

type Cat = { slug: string; name: string };
type City = { slug: string; name: string; stateSlug?: string };

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
  const [cityOpen, setCityOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState("");

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-black/10 bg-white">
        <div className="container-site flex h-16 items-center gap-3">
          <Link href="/" className="logo-mark">
            <span className="dot" />
            {siteName.toLowerCase()}
          </Link>
          <button type="button" className="hidden items-center gap-1 text-xs text-[#888] sm:flex" onClick={() => setCityOpen(true)}>
            {countryName} <ChevronDown size={12} />
          </button>
          <form
            className="header-search mx-2 hidden md:flex"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(true);
            }}
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              onFocus={() => setSearch(true)}
            />
            <button type="button" aria-label="Search" onClick={() => setSearch(true)}>
              <Search size={16} />
            </button>
          </form>
          <div className="relative ml-auto flex items-center gap-2">
            <button className="rounded p-2 md:hidden" aria-label="Search" onClick={() => setSearch(true)}>
              <Search size={20} />
            </button>
            <button type="button" aria-label="Account" className="rounded p-2 text-[#444]" onClick={() => setMenu((v) => !v)}>
              <User size={20} />
            </button>
            {menu ? (
              <div className="absolute right-0 top-10 z-40 w-56 border bg-white text-[13px] shadow-lg">
                <Link href="/u/login/" className="block px-3 py-2 hover:bg-[#f5f5f5]" onClick={() => setMenu(false)}>
                  Log in
                </Link>
                <Link href="/u/register/" className="block px-3 py-2 hover:bg-[#f5f5f5]" onClick={() => setMenu(false)}>
                  Register
                </Link>
                <Link href="/u/account/dashboard/" className="block px-3 py-2 hover:bg-[#f5f5f5]" onClick={() => setMenu(false)}>
                  Dashboard
                </Link>
                <Link href="/u/account/ads/" className="block px-3 py-2 hover:bg-[#f5f5f5]" onClick={() => setMenu(false)}>
                  Ads
                </Link>
                <Link href="/u/account/credits/" className="block px-3 py-2 hover:bg-[#f5f5f5]" onClick={() => setMenu(false)}>
                  Wallet
                </Link>
                <Link href="/u/account/coupons/" className="block px-3 py-2 hover:bg-[#f5f5f5]" onClick={() => setMenu(false)}>
                  Coupons
                </Link>
                <Link href="/u/account/media/" className="block px-3 py-2 hover:bg-[#f5f5f5]" onClick={() => setMenu(false)}>
                  Media
                </Link>
                <Link href="/u/account/analytics/" className="block px-3 py-2 hover:bg-[#f5f5f5]" onClick={() => setMenu(false)}>
                  Analytics
                </Link>
                <Link href="/u/account/subscription/" className="block px-3 py-2 hover:bg-[#f5f5f5]" onClick={() => setMenu(false)}>
                  Subscription
                </Link>
                <Link href="/u/account/edit-account/" className="block px-3 py-2 hover:bg-[#f5f5f5]" onClick={() => setMenu(false)}>
                  Settings
                </Link>
                <Link href="/u/logout/" className="block px-3 py-2 hover:bg-[#f5f5f5]" onClick={() => setMenu(false)}>
                  Log out
                </Link>
              </div>
            ) : null}
            <Link href="/u/post-insert/" className="btn-post hidden sm:inline">
              {postCta}
            </Link>
          </div>
        </div>
      </header>
      <Link href="/u/post-insert/" className="sticky-post btn-post shadow-lg">
        {postCta}
      </Link>
      {search ? <SearchModal categories={categories} cities={cities} onClose={() => setSearch(false)} /> : null}
      {cityOpen ? <CityPicker cities={cities} onClose={() => setCityOpen(false)} /> : null}
    </>
  );
}
