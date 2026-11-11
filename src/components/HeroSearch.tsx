"use client";

import { Search } from "lucide-react";

export function HeroSearch({ label = "Search By City, Category..." }: { label?: string }) {
  return (
    <button
      type="button"
      className="tk-hero-search"
      data-tk="hero-search"
      onClick={() => window.dispatchEvent(new Event("tk-open-search"))}
    >
      <span>{label}</span>
      <Search size={20} />
    </button>
  );
}
