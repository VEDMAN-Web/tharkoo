"use client";

import { useRouter } from "next/navigation";

export type SortOption = { value: string; label: string; href: string };

export function SortSelect({ label, value, options }: { label: string; value: string; options: SortOption[] }) {
  const router = useRouter();
  return (
    <label className="tkn-sr-sort">
      <span className="tkn-sr-sort-label">{label}</span>
      <select
        value={value}
        onChange={(event) => {
          const next = options.find((option) => option.value === event.target.value);
          if (next) router.push(next.href);
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
