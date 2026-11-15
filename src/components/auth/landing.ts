import { isStaffRole, safeNext } from "@/lib/ui/api";

export const ACCOUNT_PATH = "/u/account/";

export function landingFor(input: { roles: string[] | undefined; next: string | null }): string {
  const next = safeNext(input.next);
  if (isStaffRole(input.roles)) return next ?? "/admin/";
  return next ?? ACCOUNT_PATH;
}
