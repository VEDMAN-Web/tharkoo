export type StaffRole = "support" | "moderator" | "trust_safety" | "seo_editor" | "finance" | "admin" | "superadmin";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  /** Inline SVG path data (24 x 24 viewBox, stroke icon). */
  icon: string;
  /** Lowest role that can open the screen. */
  minRole: StaffRole;
  /** Set when the screen is not built yet: the item opens a placeholder that says "Coming in <task>". */
  task?: string;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

const ICON = {
  home: "M3 11.5 12 4l9 7.5M5.5 10v9h13v-9",
  page: "M7 3h7l4 4v14H7zM14 3v4h4",
  image: "M4 5h16v14H4zM8 10a1.5 1.5 0 1 0 0-.01M4 17l5-5 4 4 3-3 4 4",
  text: "M5 6h14M5 12h14M5 18h9",
  menu: "M4 7h16M4 12h16M4 17h16",
  bell: "M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4",
  tag: "M4 4h8l8 8-8 8-8-8zM8 8h.01",
  pin: "M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11zM12 10.5a2 2 0 1 0 0-.01",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  flag: "M5 21V4M5 5h11l-2 4 2 4H5",
  id: "M3 6h18v12H3zM8 11a2 2 0 1 0 0-.01M5.5 16c.5-1.5 5-1.5 5 0M14 10h4M14 14h4",
  list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  chart: "M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18",
  robot: "M6 8h12v10H6zM12 4v4M9 13h.01M15 13h.01M9 16h6",
  coin: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM9.5 9.5C10 8.5 11 8 12 8c1.5 0 2.5.8 2.5 2s-1 1.7-2.5 2-2.5.8-2.5 2 1 2 2.5 2c1 0 2-.5 2.5-1.5M12 6.5v1.5M12 16v1.5",
  box: "M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8",
  ticket: "M4 8a2 2 0 0 0 0 4v0a2 2 0 0 0 0 4v2h16v-2a2 2 0 0 1 0-4v0a2 2 0 0 1 0-4V6H4zM12 6v12",
  wallet: "M4 7h14a2 2 0 0 1 2 2v9H6a2 2 0 0 1-2-2zM4 7V6a2 2 0 0 1 2-2h10M16 13h2",
  user: "M12 12a4 4 0 1 0 0-.01M5 20c1-4 4-5 7-5s6 1 7 5",
  team: "M9 11a3 3 0 1 0 0-.01M3 19c.5-3 3-4.5 6-4.5s5.5 1.5 6 4.5M16 8a2.5 2.5 0 1 1 0 5M17 15c2 .3 3.5 1.5 4 4",
  gear: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1",
  toggle: "M7 8h10a4 4 0 0 1 0 8H7a4 4 0 0 1 0-8zM17 12h.01",
  history: "M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4M12 8v4l3 2",
  layers: "M12 4l9 5-9 5-9-5zM3 14l9 5 9-5",
} as const;

function item(
  id: string,
  label: string,
  href: string,
  icon: keyof typeof ICON,
  minRole: StaffRole,
  task?: string,
): NavItem {
  return { id, label, href: task ? `/admin/coming/${id}/` : href, icon: ICON[icon], minRole, task };
}

/** Sidebar groups and screens, as in docs/claude/ADMIN_PLAN.md section 4. */
export const NAV_GROUPS: NavGroup[] = [
  { id: "overview", label: "Overview", items: [item("dashboard", "Dashboard", "/admin/", "chart", "support")] },
  {
    id: "pages",
    label: "Pages",
    items: [
      item("home-page", "Home page", "/admin/homepage/", "home", "admin"),
      item("listing-pages", "Listing pages", "/admin/listing-pages/", "page", "admin", "H3.5"),
      item("post-ad-page", "Post-ad page", "/admin/post-ad-page/", "page", "admin", "H3.6"),
      item("ui-text", "UI text", "/admin/ui-text/", "text", "admin", "H3.7"),
      item("menus", "Menus & footer", "/admin/menus/", "menu", "admin"),
      item("banners", "Banners & notices", "/admin/banners/", "bell", "admin", "later"),
      item("media", "Media library", "/admin/media/", "image", "admin", "H3.3"),
    ],
  },
  {
    id: "catalogue",
    label: "Catalogue",
    items: [
      item("categories", "Categories & post fields", "/admin/categories/", "grid", "admin"),
      item("locations", "Locations", "/admin/locations/", "pin", "admin"),
      item("tags", "Tags / sub-categories", "/admin/tags/", "tag", "seo_editor"),
    ],
  },
  {
    id: "listings",
    label: "Listings",
    items: [
      item("moderation", "Moderation queue", "/admin/moderation/", "shield", "moderator"),
      item("all-ads", "All ads", "/admin/listings/", "list", "moderator"),
      item("listing-order", "Listing order", "/admin/listing-order/", "layers", "admin"),
      item("reports", "Reports", "/admin/reports/", "flag", "trust_safety"),
      item("id-checks", "ID checks", "/admin/kyc/", "id", "trust_safety"),
    ],
  },
  {
    id: "seo",
    label: "SEO",
    items: [
      item("seo-overview", "SEO overview", "/admin/seo/", "search", "seo_editor"),
      item("seo-issues", "Pages & issues", "/admin/seo-issues/", "list", "seo_editor", "later"),
      item("seo-templates", "Templates", "/admin/templates/", "page", "seo_editor"),
      item("seo-overrides", "Page overrides", "/admin/urls/", "link", "seo_editor"),
      item("seo-redirects", "Redirects & 404s", "/admin/redirects/", "link", "seo_editor", "later"),
      item("seo-indexing", "Indexing rules & sitemaps", "/admin/indexing/", "globe", "seo_editor", "later"),
      item("seo-robots", "robots, llms & schema", "/admin/robots/", "robot", "seo_editor", "later"),
      item("seo-console", "Search Console", "/admin/search-console/", "chart", "seo_editor", "later"),
    ],
  },
  {
    id: "money",
    label: "Money",
    items: [
      item("promotions", "Promotions", "/admin/promotions/", "coin", "finance"),
      item("credit-packs", "Credit packs", "/admin/credit-packs/", "box", "finance"),
      item("coupons", "Coupons", "/admin/coupons/", "ticket", "finance"),
      item("finance", "Finance", "/admin/finance/", "wallet", "finance"),
    ],
  },
  {
    id: "people",
    label: "People",
    items: [
      item("users", "Users", "/admin/users/", "user", "support"),
      item("team", "Team & roles", "/admin/admins/", "team", "superadmin"),
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      item("settings", "Settings", "/admin/settings/", "gear", "superadmin"),
      item("flags", "Feature flags", "/admin/flags/", "toggle", "superadmin"),
      item("audit", "Audit log", "/admin/audit/", "history", "admin"),
    ],
  },
  {
    id: "other",
    label: "Other tools",
    items: [
      item("landings", "Landing pages", "/admin/landings/", "page", "admin"),
      item("cms-pages", "Pages (CMS)", "/admin/pages/", "page", "admin"),
    ],
  },
];

/**
 * Who sees an item:
 * - superadmin sees everything;
 * - admin sees everything except superadmin-only screens;
 * - any staff role sees `support` screens (support is the lowest staff role);
 * - otherwise the viewer needs the exact role named in `minRole`.
 */
export function canSee(roles: readonly string[], minRole: StaffRole): boolean {
  if (roles.includes("superadmin")) return true;
  if (roles.includes("admin")) return minRole !== "superadmin";
  if (minRole === "support") return roles.length > 0;
  return roles.includes(minRole);
}

export function visibleGroups(roles: readonly string[]): NavGroup[] {
  return NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter((entry) => canSee(roles, entry.minRole)) })).filter(
    (group) => group.items.length > 0,
  );
}

export function findItem(id: string): NavItem | undefined {
  for (const group of NAV_GROUPS) {
    const found = group.items.find((entry) => entry.id === id);
    if (found) return found;
  }
  return undefined;
}
