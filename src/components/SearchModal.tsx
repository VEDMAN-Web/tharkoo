"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Cat = { slug: string; name: string };
type City = { slug: string; name: string };

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
  const [location, setLocation] = useState("");
  const [photos, setPhotos] = useState(false);
  const [verified, setVerified] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (location) params.set("location", location);
    if (photos) params.set("photos", "1");
    if (verified) params.set("verified", "1");
    onClose();
    router.push(`/search?${params.toString()}`);
  }

  return (
    <div className="fixed inset-0 z-50 bg-white">
      <form onSubmit={submit} className="container-site flex max-w-xl flex-col gap-3 py-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Search</h2>
          <button type="button" onClick={onClose} className="text-sm underline">
            Close
          </button>
        </div>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Keyword"
          className="rounded border px-3 py-2"
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded border px-3 py-2">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={location} onChange={(e) => setLocation(e.target.value)} className="rounded border px-3 py-2">
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={photos} onChange={(e) => setPhotos(e.target.checked)} />
          With photos only
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
          Verified only
        </label>
        <button className="rounded bg-[var(--brand-accent)] px-4 py-2.5 text-sm font-semibold text-white">
          Show results
        </button>
      </form>
    </div>
  );
}
