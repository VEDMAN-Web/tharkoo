"use client";

import { useState } from "react";
import { SearchModal } from "./SearchModal";

type Cat = { slug: string; name: string };
type City = { slug: string; name: string; stateSlug?: string };

export function HeroBand({
  brand,
  placeholder,
  categories,
  cities,
}: {
  brand: string;
  placeholder: string;
  categories: Cat[];
  cities: City[];
}) {
  const [search, setSearch] = useState(false);
  return (
    <>
      <section className="hero-home">
        <div className="hero-grade" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="hero-photo" src="/placeholders/p1.jpg" alt="" />
        <p className="hero-claim">
          Single? Taken? Doesn&apos;t matter,
          <br />
          Tharkoo is for everyone
        </p>
        <div className="sk-container hero-search-wrap">
          <button type="button" className="hero-search" onClick={() => setSearch(true)}>
            <span>{placeholder}</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607z" />
            </svg>
          </button>
        </div>
      </section>
      {search ? (
        <SearchModal brand={brand} placeholder={placeholder} categories={categories} cities={cities} onClose={() => setSearch(false)} />
      ) : null}
    </>
  );
}
