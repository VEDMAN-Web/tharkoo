"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Dialog } from "./ui/Dialog";

type Cat = { slug: string; name: string };
type City = { slug: string; name: string; stateSlug?: string };

export function SearchModal({
  placeholder = "Search jobs, homes, cars, pets...",
  categories,
  cities,
  onClose,
}: {
  brand?: string;
  placeholder?: string;
  categories: Cat[];
  cities: City[];
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [cityQ, setCityQ] = useState("");
  const [hi, setHi] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const stored = JSON.parse(localStorage.getItem("tk-recent-q") || "[]");
        if (Array.isArray(stored)) setRecent(stored.slice(0, 6));
      } catch {
        /* ignore */
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const matches = useMemo(() => {
    const needle = cityQ.trim().toLowerCase();
    return cities.filter((item) => !needle || item.name.toLowerCase().includes(needle)).slice(0, 8);
  }, [cities, cityQ]);

  function remember() {
    if (!q.trim()) return;
    const next = [q.trim(), ...recent.filter((item) => item !== q.trim())].slice(0, 6);
    localStorage.setItem("tk-recent-q", JSON.stringify(next));
  }

  return (
    <Dialog open title="Search" onClose={onClose}>
      <form action="/search/" method="get" className="grid gap-3" onSubmit={remember}>
        <input
          autoFocus
          name="q"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder={placeholder}
          aria-label="Search"
          className="h-12 w-full rounded-md border border-line bg-surface px-3 text-base"
        />
        <label className="grid gap-1 t-small">
          Category
          <select name="category" value={category} onChange={(event) => setCategory(event.target.value)} className="h-12 rounded-md border border-line bg-surface px-3 text-base">
            <option value="">All categories</option>
            {categories.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <div>
          <label className="grid gap-1 t-small" htmlFor="city-type">
            City
          </label>
          <input type="hidden" name="city" value={city} />
          <input
            id="city-type"
            value={cityQ}
            onChange={(event) => {
              setCityQ(event.target.value);
              setCity("");
              setHi(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setHi((n) => Math.min(matches.length - 1, n + 1));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setHi((n) => Math.max(0, n - 1));
              }
              if (event.key === "Enter" && matches[hi]) {
                event.preventDefault();
                setCity(matches[hi].slug);
                setCityQ(matches[hi].name);
              }
            }}
            placeholder="Type a city"
            className="mt-1 h-12 w-full rounded-md border border-line bg-surface px-3 text-base"
            role="combobox"
            aria-expanded="true"
            aria-controls="city-list"
            aria-autocomplete="list"
          />
          <ul id="city-list" className="mt-1 max-h-48 overflow-auto rounded-md border border-line" role="listbox">
            {matches.length ? (
              matches.map((item, index) => (
                <li key={item.slug}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={city === item.slug || index === hi}
                    className={`block w-full px-3 py-2 text-left t-small ${index === hi ? "bg-surface-2 text-gold" : ""}`}
                    onClick={() => {
                      setCity(item.slug);
                      setCityQ(item.name);
                    }}
                  >
                    {item.name}
                  </button>
                </li>
              ))
            ) : (
              <li className="px-3 py-2 t-small text-muted">No match</li>
            )}
          </ul>
        </div>
        <button className="gold-btn" type="submit">
          Search
        </button>
      </form>
      {recent.length ? (
        <div className="mt-4">
          <p className="t-overline mb-2">Recent</p>
          <div className="flex flex-wrap gap-2">
            {recent.map((item) => (
              <Link key={item} href={`/search/?q=${encodeURIComponent(item)}`} className="rounded-pill border border-line px-3 py-1 t-small" prefetch={false}>
                {item}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {categories.slice(0, 6).map((item) => (
          <Link key={item.slug} href={`/${item.slug}/`} className="rounded-pill border border-line px-3 py-1 t-small" prefetch={false} onClick={onClose}>
            {item.name}
          </Link>
        ))}
      </div>
    </Dialog>
  );
}
