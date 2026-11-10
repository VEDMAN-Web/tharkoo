"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type CityCtx = { city?: string; setCity: (name?: string) => void };

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
]);

export function CityProvider({
  children,
  cities,
}: {
  children: React.ReactNode;
  cities: { slug: string; name: string }[];
}) {
  const path = usePathname() || "/";
  const [override, setCity] = useState<string | undefined>();
  const fromPath = useMemo(() => {
    const parts = path.split("/").filter(Boolean);
    for (const part of parts) {
      if (RESERVED.has(part)) continue;
      const hit = cities.find((c) => c.slug === part);
      if (hit) return hit.name;
    }
    return undefined;
  }, [path, cities]);

  useEffect(() => {
    // Route changes intentionally reset the user-selected city override.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!path.startsWith("/ad")) setCity(undefined);
  }, [path]);

  return <Ctx.Provider value={{ city: override || fromPath, setCity }}>{children}</Ctx.Provider>;
}

export function useCity() {
  return useContext(Ctx);
}

export function CitySync({ name }: { name?: string }) {
  const { setCity } = useCity();
  useEffect(() => {
    if (!name) return;
    setCity(name);
    return () => setCity(undefined);
  }, [name, setCity]);
  return null;
}
