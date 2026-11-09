"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { TAG_GROUPS } from "@/data/catalog";
import { Logo } from "./Logo";

type Cat = { slug: string; name: string };
type City = { slug: string; name: string; stateSlug?: string };

export function SearchModal({
  brand = "tharkoo",
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
    <div className="fixed inset-0 z-50 overflow-auto bg-[#ececec]">
      <div className="site-header">
        <div className="sk-container sk-nav">
          <Logo name={brand} />
          <button type="button" className="ml-auto text-[13px] text-[#555]" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <form onSubmit={submit} className="sk-container max-w-[520px] py-8">
        <h1 className="text-[26px] font-normal text-[#222]">Search</h1>
        <div className="mt-5 grid gap-3 bg-white p-5">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            className="border border-[#ccc] px-3 py-2.5"
          />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="border border-[#ccc] px-3 py-2.5">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={state} onChange={(e) => { setState(e.target.value); setLocation(""); }} className="border border-[#ccc] px-3 py-2.5">
            <option value="">All states</option>
            {states.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select value={location} onChange={(e) => setLocation(e.target.value)} className="border border-[#ccc] px-3 py-2.5">
            <option value="">All cities</option>
            {cityOpts.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="District (optional)" className="border border-[#ccc] px-3 py-2.5" />
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={photos} onChange={(e) => setPhotos(e.target.checked)} />
            With photos only
          </label>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
            Verified only
          </label>
          <button type="button" className="self-start text-[13px]" onClick={() => setAdvanced((v) => !v)}>
            {advanced ? "Hide advanced filters" : "Advanced filters"}
          </button>
          {advanced
            ? TAG_GROUPS.map((g) => (
                <label key={g.key} className="field">
                  {g.label}
                  <select value={tags[g.key] || ""} onChange={(e) => setTags({ ...tags, [g.key]: e.target.value })}>
                    <option value="">Any</option>
                    {g.options.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </label>
              ))
            : null}
          <button className="btn-post self-start">Show results</button>
        </div>
      </form>
    </div>
  );
}
