import { canSee, NAV_GROUPS, type StaffRole } from "@/components/admin/nav";
import { isStaffRole } from "@/server/auth/service";

/**
 * The lowest role that may open a /admin path, taken from the sidebar map (the most specific href wins).
 * A path the sidebar does not name needs `admin`, so a new screen is closed until it is listed.
 */
export function routeMinRole(pathname: string): StaffRole {
  const path = pathname.endsWith("/") ? pathname : `${pathname}/`;
  let best: { href: string; minRole: StaffRole } | null = null;
  for (const group of NAV_GROUPS) {
    for (const entry of group.items) {
      const href = entry.href;
      const matches = path === href || (href !== "/admin/" && path.startsWith(href));
      if (matches && (!best || href.length > best.href.length)) best = { href, minRole: entry.minRole };
    }
  }
  return best?.minRole ?? "admin";
}

/** A staff member may open a screen only when the sidebar would show it to them. */
export function canOpenAdminPath(roles: readonly string[], pathname: string): boolean {
  return isStaffRole([...roles]) && canSee(roles, routeMinRole(pathname));
}
