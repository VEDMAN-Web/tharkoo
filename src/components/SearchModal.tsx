"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { TAG_GROUPS } from "@/data/catalog";

type Cat = { slug: string; name: string };
type City = { slug: string; name: string; stateSlug?: string };

export function SearchModal({
  placeholder = "Search by City, Category...",
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
  const router = useRouter();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [state, setState] = useState("");
  const [location, setLocation] = useState("");
  const [district, setDistrict] = useState("");
  const [photos, setPhotos] = useState(false);
  const [verified, setVerified] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [tags, setTags] = useState<Record<string, string>>({});

  const states = useMemo(() => [...new Set(cities.map((c) => c.stateSlug).filter(Boolean))] as string[], [cities]);
  const cityOpts = cities.filter((c) => !state || c.stateSlug === state);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (location) params.set("location", location);
    if (district) params.set("district", district);
    if (photos) params.set("photos", "1");
    if (verified) params.set("verified", "1");
    Object.entries(tags).forEach(([k, v]) => v && params.set(k, v));
    onClose();
    if (!q && location && category) {
      router.push(`/${category}/${location}/`);
      return;
    }
    router.push(`/search/?${params.toString()}`);
  }

  return (
    <div className="search-modal" onClick={onClose}>
      <div className="search-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="search-modal-head">
          <h5>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607z" />
            </svg>
            Search
          </h5>
          <button type="button" className="search-modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={submit} className="search-modal-body">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} />
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              setLocation("");
            }}
          >
            <option value="">All states</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select value={location} onChange={(e) => setLocation(e.target.value)}>
            <option value="">All cities</option>
            {cityOpts.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="District (optional)" />
          <label className="search-check">
            <input type="checkbox" checked={photos} onChange={(e) => setPhotos(e.target.checked)} />
            With photos only
          </label>
          <label className="search-check">
            <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
            Verified only
          </label>
          <button type="button" className="search-advanced" onClick={() => setAdvanced((v) => !v)}>
            {advanced ? "Hide advanced filters" : "Advanced filters"}
          </button>
          {advanced
            ? TAG_GROUPS.map((g) => (
                <label key={g.key} className="field">
                  {g.label}
                  <select value={tags[g.key] || ""} onChange={(e) => setTags({ ...tags, [g.key]: e.target.value })}>
                    <option value="">Any</option>
                    {g.options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
              ))
            : null}
          <button className="btn-post btn-block" type="submit">
            Show results
          </button>
        </form>
      </div>
    </div>
  );
}
