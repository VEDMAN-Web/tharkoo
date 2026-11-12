import Link from "next/link";

const TABS = [
  { href: "/admin/seo/", label: "Overview" },
  { href: "/admin/seo/pages/", label: "Pages & issues" },
  { href: "/admin/seo/templates/", label: "Templates" },
  { href: "/admin/urls/", label: "Page overrides" },
  { href: "/admin/seo/indexing/", label: "Indexing" },
  { href: "/admin/seo/settings/", label: "robots, llms & schema" },
];

export function SeoTabs({ current }: { current: string }) {
  return (
    <nav aria-label="SEO center" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={tab.href === current ? "adm-btn" : "adm-btn adm-btn-quiet"}
          aria-current={tab.href === current ? "page" : undefined}
          style={{ minHeight: 40 }}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
