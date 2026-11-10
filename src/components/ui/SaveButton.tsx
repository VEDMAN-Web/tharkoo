"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

export type SavedItem = { id: string; slug: string; title: string; photo?: string | null; place?: string; at: number };

const KEY = "tk-saved";

export function readSaved(): SavedItem[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSaved(items: SavedItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items.slice(0, 100)));
  window.dispatchEvent(new Event("tk-saved"));
}

export function SaveButton({
  item,
  className,
  label = "Save",
}: {
  item: SavedItem;
  className?: string;
  label?: string;
}) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const sync = () => setOn(readSaved().some((row) => row.id === item.id));
    sync();
    window.addEventListener("tk-saved", sync);
    return () => window.removeEventListener("tk-saved", sync);
  }, [item.id]);

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "Remove saved ad" : "Save ad"}
      className={cn("inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full bg-black/50 px-2 text-text", className)}
      onClick={() => {
        // TODO(T8.x): POST /api/saved/{id} when the route exists
        const next = readSaved().filter((row) => row.id !== item.id);
        if (!on) next.unshift({ ...item, at: Date.now() });
        writeSaved(next);
        setOn(!on);
      }}
    >
      <Heart className={on ? "fill-current text-gold" : ""} size={18} />
      {label === "Save" ? null : <span className="t-small">{on ? "Saved" : label}</span>}
    </button>
  );
}
