"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "./Logo";

type City = { slug: string; name: string; stateSlug?: string };

export function CityPicker({
  brand = "tharkoo",
  cities,
  category = "call-girls",
  onClose,
}: {
  brand?: string;
  cities: City[];
  category?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () => cities.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())),
    [cities, q],
  );

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
      <div className="sk-container py-8">
        <h1 className="text-[26px] font-normal text-[#222]">Choose a city</h1>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search city"
          className="mt-4 w-full max-w-md border border-[#ccc] bg-white px-3 py-2.5"
        />
        <ul className="mt-5 columns-2 gap-6 text-[14px] md:columns-3">
          {filtered.map((c) => (
            <li key={c.slug} className="break-inside-avoid py-1">
              <button
                type="button"
                className="text-left"
                onClick={() => {
                  router.push(`/${category}/${c.slug}/`);
                  onClose();
                }}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
        {!filtered.length ? <p className="mt-6 text-sm text-[#777]">No city found</p> : null}
      </div>
    </div>
  );
}
