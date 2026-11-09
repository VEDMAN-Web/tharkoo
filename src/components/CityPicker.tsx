"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type City = { slug: string; name: string; stateSlug?: string };

export function CityPicker({
  cities,
  category = "call-girls",
  onClose,
}: {
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
    <div className="fixed inset-0 z-50 bg-white">
      <div className="container-site py-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Choose a city</h2>
          <button type="button" onClick={onClose} className="text-sm underline">
            Close
          </button>
        </div>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search city"
          className="mt-4 w-full border px-3 py-2"
        />
        <ul className="mt-4 columns-2 gap-4 text-sm md:columns-3">
          {filtered.map((c) => (
            <li key={c.slug} className="break-inside-avoid py-1">
              <button
                type="button"
                className="text-left text-[var(--sk-link)]"
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
