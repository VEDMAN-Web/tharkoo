"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  ["/u/account/dashboard/", "Dashboard"],
  ["/u/account/ads/", "Ads"],
  ["/u/account/credits/", "Wallet"],
  ["/u/account/coupons/", "Coupons"],
  ["/u/account/media/", "Media"],
  ["/u/account/analytics/", "Analytics"],
  ["/u/account/subscription/", "Subscription"],
  ["/u/account/edit-account/", "Settings"],
];

export function VendorShell({
  title,
  children,
  verified = true,
}: {
  title: string;
  children: React.ReactNode;
  verified?: boolean;
}) {
  const path = usePathname();
  return (
    <div className="-mx-2 md:mx-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[#ddd] bg-white px-2 py-2">
        <p className="text-[13px]">
          Customer Code <strong>IN46SXA6</strong>
          {verified ? <span className="ml-2 text-[#1abc9c]">ID verified</span> : <span className="ml-2 text-[#e20044]">Locked</span>}
        </p>
        <Link href="/u/logout/" className="text-[13px]">
          Log out
        </Link>
      </div>
      <nav className="mb-4 flex flex-wrap gap-1 text-[13px]">
        {NAV.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className={`px-3 py-2 no-underline ${path === href ? "bg-[var(--sk-blue)] text-white" : "bg-white text-[#333]"}`}
          >
            {label}
          </Link>
        ))}
        <Link href="/u/post-insert/" className="btn-post">
          Post your ad
        </Link>
      </nav>
      <h1 className="mb-4 text-[22px] font-normal">{title}</h1>
      {children}
    </div>
  );
}

export function Tile({ title, children, href }: { title: string; children: React.ReactNode; href: string }) {
  return (
    <Link href={href} className="block bg-white p-4 text-[#333] no-underline shadow-sm hover:shadow">
      <h2 className="text-[15px] font-bold">{title}</h2>
      <div className="mt-2 text-[13px] text-[#666]">{children}</div>
    </Link>
  );
}
