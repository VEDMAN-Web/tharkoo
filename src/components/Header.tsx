"use client";

import Link from "next/link";
import { Search, User } from "lucide-react";
import { useState } from "react";
import { SearchModal } from "./SearchModal";

type Cat = { slug: string; name: string };
type City = { slug: string; name: string };

export function Header({
  siteName,
  countryName,
  categories,
  cities,
}: {
  siteName: string;
  countryName: string;
  categories: Cat[];
  cities: City[];
}) {
  const [search, setSearch] = useState(false);
  const [q, setQ] = useState("");

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-black/10 bg-white">
        <div className="container-site flex h-16 items-center gap-3">
          <Link href="/" className="logo-mark">
            <span className="dot" />
            {siteName.toLowerCase()}
          </Link>
          <span className="hidden text-xs text-[#888] sm:inline">{countryName}</span>
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
              placeholder="Search by City, Category..."
              onFocus={() => setSearch(true)}
            />
            <button type="button" aria-label="Search" onClick={() => setSearch(true)}>
              <Search size={16} />
            </button>
          </form>
          <div className="ml-auto flex items-center gap-2">
            <button className="rounded p-2 md:hidden" aria-label="Search" onClick={() => setSearch(true)}>
              <Search size={20} />
            </button>
            <Link href="/u/login" aria-label="Account" className="rounded p-2 text-[#444] hover:text-black">
              <User size={20} />
            </Link>
            <Link href="/u/post-insert" className="btn-post hidden sm:inline">
              Post your ad
            </Link>
          </div>
        </div>
      </header>
      <Link href="/u/post-insert" className="sticky-post btn-post shadow-lg">
        Post your ad
      </Link>
      {search ? (
        <SearchModal categories={categories} cities={cities} onClose={() => setSearch(false)} />
      ) : null}
    </>
  );
}
