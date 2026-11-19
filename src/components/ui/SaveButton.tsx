"use client";

import { trackEvent } from "@/lib/analytics/ga";
import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { api, hasSessionHint } from "@/lib/ui/api";
import { cn } from "@/lib/utils";

/** `acct`: saved while signed in, so the account has it (an ad that is missing from the account later was removed on another device). */
export type SavedItem = { id: string; slug: string; title: string; photo?: string | null; place?: string; at: number; acct?: boolean };

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

const sameAd = (row: SavedItem, item: Pick<SavedItem, "id" | "slug">) => row.id === item.id || (Boolean(item.slug) && row.slug === item.slug);

/**
 * H15.7: for a signed-in visitor the saved list is the ACCOUNT's (the same on every device). The account list is read from the server;
 * ads this device saved before sign-in go up to the account; then the device copy mirrors the account so every heart agrees.
 * Returns null when nobody is signed in (or the server cannot be reached): the device list stands.
 */
export async function loadAccountSaved(): Promise<SavedItem[] | null> {
  if (!hasSessionHint()) return null;
  const res = await api<{ items: { slug: string; title: string; place?: string; photo?: string | null; at?: number }[] }>("/api/saved/");
  if (!res.ok) return null;
  const account: SavedItem[] = res.data.items.map((row) => ({ id: row.slug, slug: row.slug, title: row.title, place: row.place ?? "", photo: row.photo ?? null, at: row.at ?? 0, acct: true }));
  const known = new Set(account.map((row) => row.slug));
  // Only what was saved while signed out goes up. What was saved while signed in and is gone from the account was removed elsewhere: it is dropped here too.
  const signedOutOnly = readSaved().filter((row) => row.slug && !known.has(row.slug) && !row.acct);
  await Promise.all(signedOutOnly.map((row) => api("/api/saved/", { method: "POST", body: JSON.stringify({ slug: row.slug }) })));
  const merged = [...account, ...signedOutOnly.map((row) => ({ ...row, acct: true }))].sort((a, b) => b.at - a.at);
  writeSaved(merged);
  return merged;
}

/** Takes one ad off the saved list: on this device and, when signed in, on the account. */
export async function removeSaved(item: Pick<SavedItem, "id" | "slug">) {
  writeSaved(readSaved().filter((row) => !sameAd(row, item)));
  if (hasSessionHint() && item.slug) await api("/api/saved/", { method: "DELETE", body: JSON.stringify({ slug: item.slug }) });
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
  const [popping, setPopping] = useState(false);

  useEffect(() => {
    const sync = () => setOn(readSaved().some((row) => sameAd(row, item)));
    sync();
    window.addEventListener("tk-saved", sync);
    return () => window.removeEventListener("tk-saved", sync);
  }, [item.id]);

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label === "Save" ? (on ? "Remove saved ad" : "Save ad") : undefined}
      className={cn("inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full bg-white px-2 text-[#c2185b] shadow-[0_2px_8px_rgba(45,18,72,0.12)]", className)}
      onClick={() => {
        const next = readSaved().filter((row) => !sameAd(row, item));
        if (!on) {
          next.unshift({ ...item, at: Date.now(), acct: hasSessionHint() });
          trackEvent("save_ad");
        }
        writeSaved(next);
        setOn(!on);
        setPopping(true);
        if (hasSessionHint() && item.slug) {
          void api("/api/saved/", {
            method: on ? "DELETE" : "POST",
            body: JSON.stringify({ slug: item.slug }),
          });
        }
      }}
    >
      <Heart
        className={[on ? "fill-current text-accent" : "", popping ? "m-heart" : ""].join(" ").trim()}
        size={18}
        onAnimationEnd={() => setPopping(false)}
      />
      {label === "Save" ? null : <span className="t-small">{on ? "Saved" : label}</span>}
    </button>
  );
}
