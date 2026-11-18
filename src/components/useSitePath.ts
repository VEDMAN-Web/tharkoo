"use client";

import { usePathname } from "next/navigation";
import { normalizePathname } from "@/lib/site-path";

/** The page address, the same on the server and in the browser. Use this instead of usePathname for anything that shows or hides markup. */
export function useSitePath(): string {
  return normalizePathname(usePathname());
}
