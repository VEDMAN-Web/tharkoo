"use client";

import Link from "next/link";
import { ChevronDown, Search, User } from "lucide-react";
import { useState } from "react";
import { SearchModal } from "./SearchModal";
import { CityPicker } from "./CityPicker";
import { Logo } from "./Logo";

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
      <header className="site-header">
        <div className="container-site site-header-inner">
          <Logo name={siteName} />
          <button type="button" className="hidden items-center gap-0.5 text-[13px] text-[#888] sm:flex" onClick={() => setCityOpen(true)}>
            {countryName} <ChevronDown size={14} />
          </button>
          <form
            className="header-search mx-1 hidden md:flex"
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
          <div className="relative ml-auto flex items-center gap-1">
            <button className="p-2 md:hidden" aria-label="Search" onClick={() => setSearch(true)}>
              <Search size={20} />
            </button>
            <button type="button" aria-label="Account" className="p-2 text-[#555]" onClick={() => setMenu((v) => !v)}>
              <User size={22} />
            </button>
            {menu ? (
              <div className="absolute right-0 top-11 z-40 w-52 border border-[#e5e5e5] bg-white py-1 text-[13px] shadow-[0_8px_24px_rgba(0,0,0,.12)]">
                {[
                  ["/u/login/", "Log in"],
                  ["/u/register/", "Register"],
                  ["/u/account/dashboard/", "Dashboard"],
                  ["/u/account/ads/", "Ads"],
                  ["/u/account/credits/", "Wallet"],
                  ["/u/account/coupons/", "Coupons"],
                  ["/u/account/media/", "Media"],
                  ["/u/account/analytics/", "Analytics"],
                  ["/u/account/subscription/", "Subscription"],
                  ["/u/account/edit-account/", "Settings"],
                  ["/u/logout/", "Log out"],
                ].map(([href, label]) => (
                  <Link key={href} href={href} className="block px-4 py-2 text-[#333] no-underline hover:bg-[#f5f5f5]" onClick={() => setMenu(false)}>
                    {label}
                  </Link>
                ))}
              </div>
            ) : null}
            <Link href="/u/post-insert/" className="btn-post ml-1 hidden sm:inline">
              {postCta}
            </Link>
          </div>
        </div>
      </header>
      <Link href="/u/post-insert/" className="sticky-post btn-post">
        {postCta}
      </Link>
      {search ? <SearchModal categories={categories} cities={cities} onClose={() => setSearch(false)} /> : null}
      {cityOpen ? <CityPicker cities={cities} onClose={() => setCityOpen(false)} /> : null}
    </>
  );
}
