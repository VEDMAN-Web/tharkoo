"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  ["/u/account/dashboard/", "Dashboard"],
  ["/u/account/ads/", "Ads"],
  ["/u/account/credits/", "Wallet"],
  ["/u/account/coupons/", "Coupons"],
  ["/u/account/saved/", "Saved"],
  ["/u/account/kyc/", "Verification"],
  ["/u/account/edit-account/", "Settings"],
];

export function VendorShell({ title, children }: { title: string; children: React.ReactNode; verified?: boolean }) {
  const path = usePathname();
  return (
    <div className="mx-auto w-full min-w-0 max-w-[1200px] px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <nav className="flex gap-2 overflow-x-auto" aria-label="Account">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className={`inline-flex h-11 items-center rounded-pill px-3 t-small ${path === href ? "bg-[var(--gold-soft)] text-gold" : "text-muted"}`}>
              {label}
            </Link>
          ))}
        </nav>
        <Link href="/u/logout/" className="t-small text-muted">
          Log out
        </Link>
      </div>
      <h1 className="t-h1 mb-4">{title}</h1>
      {children}
    </div>
  );
}

export function Tile({ title, children, href }: { title: string; children: React.ReactNode; href: string }) {
  return (
    <Link href={href} className="block min-w-0 rounded-lg border border-line bg-surface p-4">
      <h2 className="t-h3">{title}</h2>
      <div className="mt-2 t-small text-muted">{children}</div>
    </Link>
  );
}
