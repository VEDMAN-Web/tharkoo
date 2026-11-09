"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { TAG_GROUPS } from "@/data/catalog";

type Cat = { slug: string; name: string };
type City = { slug: string; name: string; stateSlug?: string };

export function SearchModal({
  categories,
  cities,
  onClose,
}: {
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
    <div className="fixed inset-0 z-50 overflow-auto bg-white">
      <form onSubmit={submit} className="container-site flex max-w-xl flex-col gap-3 py-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Search</h2>
          <button type="button" onClick={onClose} className="text-sm underline">
            Close
          </button>
        </div>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by City, Category..."
          className="border px-3 py-2"
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="border px-3 py-2">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={state} onChange={(e) => { setState(e.target.value); setLocation(""); }} className="border px-3 py-2">
          <option value="">All states</option>
          {states.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={location} onChange={(e) => setLocation(e.target.value)} className="border px-3 py-2">
          <option value="">All cities</option>
          {cityOpts.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="District (optional)" className="border px-3 py-2" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={photos} onChange={(e) => setPhotos(e.target.checked)} />
          With photos only
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
          Verified only
        </label>
        <button type="button" className="self-start text-sm underline" onClick={() => setAdvanced((v) => !v)}>
          Advanced filters
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
      </form>
    </div>
  );
}
