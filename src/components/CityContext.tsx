"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type City = { slug: string; name: string };
type CityCtx = { city?: string; citySlug?: string; setCity: (name?: string, slug?: string) => void };

const Ctx = createContext<CityCtx>({ setCity: () => {} });

const RESERVED = new Set([
  "ad",
  "u",
  "admin",
  "search",
  "blog",
  "help",
  "cities",
  "about",
  "terms",
  "privacy",
  "cookies",
  "contact",
  "cms",
  "grievance",
  "gone",
  "maintenance",
  "submit-report",
  "scam-report",
  "styleguide",
]);

export function CityProvider({ children, cities }: { children: React.ReactNode; cities: City[] }) {
  const path = usePathname() || "/";
  const [override, setOverride] = useState<City | undefined>();
  const fromPath = useMemo(() => {
    const parts = path.split("/").filter(Boolean);
    for (const part of parts) {
      if (RESERVED.has(part)) continue;
      const hit = cities.find((c) => c.slug === part);
      if (hit) return hit;
    }
    return undefined;
  }, [path, cities]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (fromPath) return;
      const raw = localStorage.getItem("tk-city");
      if (!raw) return;
      try {
        const saved = JSON.parse(raw) as City;
        if (saved?.name) setOverride(saved);
      } catch {
        /* ignore stored city */
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [fromPath]);

  const setCity = useCallback((name?: string, slug?: string) => {
    if (!name) {
      setOverride(undefined);
      localStorage.removeItem("tk-city");
      return;
    }
    const next = { name, slug: slug || "" };
    setOverride(next);
    localStorage.setItem("tk-city", JSON.stringify(next));
  }, []);

  const active = fromPath || override;
  return <Ctx.Provider value={{ city: active?.name, citySlug: active?.slug, setCity }}>{children}</Ctx.Provider>;
}

export function useCity() {
  return useContext(Ctx);
}

export function CitySync({ name, slug }: { name?: string; slug?: string }) {
  const { setCity } = useCity();
  useEffect(() => {
    if (!name) return;
    setCity(name, slug);
  }, [name, slug, setCity]);
  return null;
}
