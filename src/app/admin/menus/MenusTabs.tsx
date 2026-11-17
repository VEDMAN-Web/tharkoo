import Link from "next/link";

const TABS = [
  { href: "/admin/menus/", label: "Menus and footer" },
  { href: "/admin/ui-text/", label: "Site text" },
];

/** The two screens behind "Menus & site text" in the sidebar. */
export function MenusTabs({ current, showMenus = true }: { current: string; showMenus?: boolean }) {
  return (
    <nav aria-label="Menus and site text" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
      {TABS.filter((tab) => showMenus || tab.href !== "/admin/menus/").map((tab) => (
        <Link key={tab.href} href={tab.href} className={tab.href === current ? "adm-btn" : "adm-btn adm-btn-quiet"} aria-current={tab.href === current ? "page" : undefined} style={{ minHeight: 40 }}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
