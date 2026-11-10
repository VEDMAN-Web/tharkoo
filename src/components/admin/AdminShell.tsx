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
    <div className="flex min-h-[70vh] min-w-0 bg-bg text-text">
      <aside className="admin-nav hidden w-52 shrink-0 border-r border-line md:block">
        <p className="px-3 py-3 t-caption uppercase text-muted">Tharkoo admin</p>
        {ADMIN_NAV.map(([href, label]) => (
          <Link key={href} href={href} className={path === href ? "on" : ""}>
            {label}
          </Link>
        ))}
      </aside>
      <div className="min-w-0 flex-1 overflow-x-auto p-4">
        <div className="mb-3 flex items-center justify-between t-caption text-muted">
          <span>Signed-in staff</span>
          <Link href="/u/logout/">Log out</Link>
        </div>
        <nav className="mb-3 flex gap-1 overflow-x-auto md:hidden" aria-label="Admin">
          {ADMIN_NAV.map(([href, label]) => (
            <Link key={href} href={href} className="shrink-0 rounded-pill border border-line px-2 py-1 t-caption">
              {label}
            </Link>
          ))}
        </nav>
        <h1 className="t-h2 mb-4">{title}</h1>
        {children}
      </div>
    </div>
  );
}
