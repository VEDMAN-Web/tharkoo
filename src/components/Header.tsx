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

  return (
    <>
      <header className="sticky top-0 z-30 bg-[var(--brand-primary)] text-white">
        <div className="container-site flex h-14 items-center gap-3">
          <Link href="/" className="text-lg font-bold tracking-tight text-white hover:text-white">
            {siteName}
          </Link>
          <span className="hidden text-sm text-white/70 sm:inline">{countryName}</span>
          <div className="ml-auto flex items-center gap-1">
            <button
              aria-label="Search"
              className="rounded p-2 hover:bg-white/10"
              onClick={() => setSearch(true)}
            >
              <Search size={20} />
            </button>
            <Link href="/u/login" aria-label="Account" className="rounded p-2 text-white hover:bg-white/10">
              <User size={20} />
            </Link>
            <Link
              href="/u/post-insert"
              className="ml-1 hidden rounded bg-[var(--brand-accent)] px-3 py-2 text-sm font-semibold text-white hover:text-white sm:inline"
            >
              Post your ad
            </Link>
          </div>
        </div>
      </header>
      <Link
        href="/u/post-insert"
        className="sticky-post rounded-full bg-[var(--brand-accent)] px-4 py-3 text-sm font-semibold text-white shadow-lg"
      >
        Post your ad
      </Link>
      {search ? (
        <SearchModal categories={categories} cities={cities} onClose={() => setSearch(false)} />
      ) : null}
    </>
  );
}
