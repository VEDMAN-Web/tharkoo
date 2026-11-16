import { canOpenPath } from "@/lib/admin/screens";
import { isStaffRole } from "@/server/auth/service";

/** A staff member may open a /admin path only when the screens map says their role can. A path it does not name needs admin. */
export function canOpenAdminPath(roles: readonly string[], pathname: string): boolean {
  return isStaffRole([...roles]) && canOpenPath(roles, pathname);
}
