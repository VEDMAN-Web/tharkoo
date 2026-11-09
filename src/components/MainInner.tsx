"use client";

import { usePathname } from "next/navigation";

export function MainInner({ children }: { children: React.ReactNode }) {
  const path = usePathname() || "/";
  const full = path === "/" || path.startsWith("/admin");
  return <main className={full ? "flex-1" : "sk-container flex-1 py-4"}>{children}</main>;
}
