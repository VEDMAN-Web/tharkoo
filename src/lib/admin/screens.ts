import { can, type Perm, type StaffRole } from "@/lib/admin/perms";

export type GroupId = "today" | "queues" | "people" | "money" | "website" | "catalogue" | "system";

export type CountId =
  | "reviewLive"
  | "reviewHeld"
  | "reviewEdited"
  | "reports"
  | "legal"
  | "idChecks"
  | "tickets"
  | "recharges"
  | "payouts"
  | "contentReview";

export type IconName =
  | "chart"
  | "history"
  | "shield"
  | "flag"
  | "id"
  | "ticket"
  | "list"
  | "user"
  | "wallet"
  | "coin"
  | "layers"
  | "page"
  | "image"
  | "menu"
  | "grid"
  | "pin"
  | "search"
  | "gear"
  | "team";

export interface Screen {
  id: string;
  group: GroupId;
  label: string;
  href: string;
  view: Perm;
  icon: IconName;
  counts?: readonly CountId[];
  phoneBar?: boolean;
  only?: StaffRole;
}

export interface LegacyRoute {
  href: string;
  view: Perm;
  only?: StaffRole;
}

export const GROUPS: readonly { id: GroupId; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "queues", label: "Queues" },
  { id: "people", label: "Ads & people" },
  { id: "money", label: "Money" },
  { id: "website", label: "Website" },
  { id: "catalogue", label: "Catalogue" },
  { id: "system", label: "System" },
];

export const SCREENS: readonly Screen[] = [
  { id: "dashboard", group: "today", label: "Dashboard", href: "/admin/", view: "dashboard.view", icon: "chart", phoneBar: true },
  { id: "history", group: "today", label: "History & undo", href: "/admin/history/", view: "history.view", icon: "history" },
  { id: "review", group: "queues", label: "Ads to review", href: "/admin/moderation/", view: "ads.review", icon: "shield", counts: ["reviewLive", "reviewHeld", "reviewEdited"], phoneBar: true },
  { id: "reports", group: "queues", label: "Reports", href: "/admin/reports/", view: "reports.handle", icon: "flag", counts: ["reports", "legal"] },
  { id: "id-checks", group: "queues", label: "ID checks", href: "/admin/kyc/", view: "id.decide", icon: "id", counts: ["idChecks"] },
  { id: "support", group: "queues", label: "Support desk", href: "/admin/support/", view: "desk.work", icon: "ticket", counts: ["tickets"], phoneBar: true },
  { id: "all-ads", group: "people", label: "All ads", href: "/admin/ads/", view: "ads.view", icon: "list" },
  { id: "users", group: "people", label: "Users", href: "/admin/users/", view: "users.view", icon: "user" },
  { id: "orders", group: "money", label: "Orders & credits", href: "/admin/finance/", view: "orders.view", icon: "wallet", counts: ["recharges", "payouts"] },
  { id: "prices", group: "money", label: "Prices & plans", href: "/admin/prices/", view: "prices.view", icon: "coin" },
  { id: "page-builder", group: "website", label: "Page builder", href: "/admin/page-builder/", view: "pages.edit", icon: "layers" },
  { id: "content", group: "website", label: "Content studio", href: "/admin/content/", view: "content.write", icon: "page", counts: ["contentReview"] },
  { id: "blog-posts", group: "website", label: "Blog posts", href: "/admin/blog-posts/", view: "content.write", icon: "page" },
  { id: "media", group: "website", label: "Media library", href: "/admin/media/", view: "media.library", icon: "image" },
  { id: "menus", group: "website", label: "Menus & site text", href: "/admin/menus/", view: "menus.edit", icon: "menu" },
  { id: "categories", group: "catalogue", label: "Categories & fields", href: "/admin/categories/", view: "catalogue.edit", icon: "grid" },
  { id: "cities", group: "catalogue", label: "Cities & areas", href: "/admin/locations/", view: "catalogue.edit", icon: "pin" },
  { id: "seo", group: "system", label: "SEO", href: "/admin/seo/", view: "seo.edit", icon: "search" },
  { id: "settings", group: "system", label: "Settings", href: "/admin/settings/", view: "settings.edit", icon: "gear", only: "superadmin" },
  { id: "team", group: "system", label: "Team & roles", href: "/admin/team/", view: "team.edit", icon: "team" },
];

export const LEGACY_ROUTES: readonly LegacyRoute[] = [
  { href: "/admin/notifications/", view: "dashboard.view" },
  { href: "/admin/listings/", view: "ads.view" },
  { href: "/admin/ads/home/", view: "settings.edit" },
  { href: "/admin/ads/create/", view: "settings.edit" },
  { href: "/admin/ads/photos/", view: "settings.edit" },
  { href: "/admin/blog/", view: "content.write" },
  { href: "/admin/help/", view: "content.write" },
  { href: "/admin/media/upload/", view: "media.upload" },
  { href: "/admin/help-topics/", view: "content.write" },
  { href: "/admin/tags/", view: "catalogue.seo" },
  { href: "/admin/urls/", view: "seo.edit" },
  { href: "/admin/ui-text/", view: "sitetext.edit" },
  { href: "/admin/homepage/", view: "pages.edit" },
  { href: "/admin/listing-pages/", view: "pages.edit" },
  { href: "/admin/post-page/", view: "pages.edit" },
  { href: "/admin/coupons/", view: "prices.view" },
  { href: "/admin/credit-packs/", view: "prices.view" },
  { href: "/admin/promotions/", view: "prices.view" },
  { href: "/admin/settings/money/", view: "prices.edit" },
  { href: "/admin/flags/", view: "raw.json" },
  { href: "/admin/banned-words/", view: "settings.edit" },
  { href: "/admin/broadcasts/", view: "settings.edit" },
  { href: "/admin/help-sections/", view: "settings.edit" },
];

const UNKNOWN: LegacyRoute = { href: "", view: "settings.edit" };

function withSlash(path: string): string {
  return path.endsWith("/") ? path : `${path}/`;
}

function matches(path: string, href: string): boolean {
  return href === "/admin/" ? path === href : path === href || path.startsWith(href);
}

export function screenForPath(pathname: string): { view: Perm; only?: StaffRole } {
  const path = withSlash(pathname);
  let best: LegacyRoute | null = null;
  for (const entry of [...SCREENS, ...LEGACY_ROUTES]) {
    if (!matches(path, entry.href)) continue;
    if (!best || entry.href.length > best.href.length) best = entry;
  }
  const found = best ?? UNKNOWN;
  return found.only ? { view: found.view, only: found.only } : { view: found.view };
}

export function canOpen(roles: readonly string[] | undefined, target: { view: Perm; only?: StaffRole }): boolean {
  if (!can(roles, target.view)) return false;
  return target.only ? Boolean(roles?.includes(target.only)) : true;
}

export function canOpenPath(roles: readonly string[] | undefined, pathname: string): boolean {
  return canOpen(roles, screenForPath(pathname));
}

export function visibleScreens(roles: readonly string[] | undefined): Screen[] {
  return SCREENS.filter((screen) => canOpen(roles, screen));
}
