"use client";

import { Search } from "lucide-react";

export function HeroSearch() {
  return (
    <button
      type="button"
      className="tk-hero-search"
      data-tk="hero-search"
      onClick={() => window.dispatchEvent(new Event("tk-open-search"))}
    >
      <span>Search By City, Category...</span>
      <Search size={20} />
    </button>
  );
}
