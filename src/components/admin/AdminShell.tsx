"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const ADMIN_NAV: [string, string][] = [
  ["/admin/", "Dashboard"],
  ["/admin/users/", "Users"],
  ["/admin/ads/", "Ads"],
  ["/admin/moderation/", "Moderation"],
  ["/admin/media-review/", "Media review"],
  ["/admin/kyc/", "KYC"],
  ["/admin/reports/", "Reports"],
  ["/admin/categories/", "Categories"],
  ["/admin/attributes/", "Attributes"],
  ["/admin/locations/", "Locations"],
  ["/admin/products/", "Products"],
  ["/admin/slots/", "Slots & Star"],
  ["/admin/credit-packs/", "Credit packs"],
  ["/admin/finance/", "Finance"],
  ["/admin/coupons/", "Coupons"],
  ["/admin/packs/", "Packs & subs"],
  ["/admin/banned-words/", "Banned words"],
  ["/admin/seo/", "SEO"],
  ["/admin/cms/", "CMS & banners"],
  ["/admin/help/", "Help editor"],
  ["/admin/blog/", "Blog editor"],
  ["/admin/templates/", "Templates"],
  ["/admin/broadcasts/", "Broadcasts"],
  ["/admin/support/", "Support desk"],
  ["/admin/analytics/", "Analytics"],
  ["/admin/settings/", "Settings"],
  ["/admin/flags/", "Feature flags"],
  ["/admin/admins/", "Admin users"],
  ["/admin/audit/", "Audit log"],
  ["/admin/translations/", "Translations"],
  ["/admin/grievance/", "Grievance log"],
];

export function AdminShell({ title, children }: { title: string; children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="-mx-2 flex min-h-[70vh] bg-[#1b1b1b] text-[#eee] md:mx-0">
      <aside className="admin-nav hidden w-52 shrink-0 border-r border-[#333] md:block">
        <p className="px-3 py-3 text-[11px] uppercase tracking-wide text-[#888]">Tharkoo admin</p>
        {ADMIN_NAV.map(([href, label]) => (
          <Link key={href} href={href} className={path === href ? "on" : ""}>
            {label}
          </Link>
        ))}
      </aside>
      <div className="min-w-0 flex-1 bg-[#f3f3f3] p-4 text-[#333]">
        <div className="mb-3 flex items-center justify-between text-[12px]">
          <span>2FA on · staff demo</span>
          <Link href="/admin/login/">Log out</Link>
        </div>
        <nav className="mb-3 flex flex-wrap gap-1 text-[11px] md:hidden">
          {ADMIN_NAV.map(([href, label]) => (
            <Link key={href} href={href} className="bg-white px-2 py-1">
              {label}
            </Link>
          ))}
        </nav>
        <h1 className="mb-4 text-[22px] font-normal">{title}</h1>
        {children}
      </div>
    </div>
  );
}
