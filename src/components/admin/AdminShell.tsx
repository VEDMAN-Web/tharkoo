import Link from "next/link";

const LINKS = [
  ["Overview", "/admin/"],
  ["Moderation", "/admin/moderation/"],
  ["Reports", "/admin/reports/"],
  ["Listings", "/admin/listings/"],
  ["Users", "/admin/users/"],
  ["Categories", "/admin/categories/"],
  ["Locations", "/admin/locations/"],
  ["Promotions", "/admin/promotions/"],
  ["Homepage", "/admin/homepage/"],
  ["Menus", "/admin/menus/"],
  ["Landings", "/admin/landings/"],
  ["Tags", "/admin/tags/"],
  ["URLs", "/admin/urls/"],
  ["SEO", "/admin/seo/"],
  ["Pages", "/admin/pages/"],
  ["Audit log", "/admin/audit/"],
  ["Settings", "/admin/settings/"],
];

export function AdminShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-[70vh] min-w-0 lg:grid-cols-[220px_1fr]">
      <aside className="tk-admin-nav min-w-0 max-w-full overflow-hidden">
        <p className="t-overline px-4 py-4" style={{ color: "var(--accent)" }}>Tharkoo admin</p>
        <nav className="flex max-w-full flex-row overflow-x-auto lg:flex-col">
          {LINKS.map(([label, href]) => (
            <Link key={href} href={href} className="shrink-0 px-4 py-2 t-small">
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 p-4 sm:p-6">
        <h1 className="t-h1 mb-6">{title}</h1>
        {children}
      </div>
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="tk-profile">
      <p className="t-overline" style={{ color: "var(--muted)" }}>{label}</p>
      <p className="t-h2 mt-2">{value}</p>
    </div>
  );
}
