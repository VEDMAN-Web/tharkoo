import { isStaffRole, safeNext } from "@/lib/ui/api";

export type SignInRole = "user" | "seller";

/** Where each kind of person lands after signing in. The server passes the real paths, so the URL settings apply. */
export interface LandingPaths {
  user: string;
  seller: string;
  sellerProfile: string;
  postAd: string;
}

export const DEFAULT_LANDING: LandingPaths = {
  user: "/u/account/saved/",
  seller: "/u/account/dashboard/",
  sellerProfile: "/u/seller-profile/",
  postAd: "/u/post-insert/",
};

export interface LandingInput {
  roles: string[] | undefined;
  /** True once the seller profile is saved (the account has `seller` set). */
  hasSellerProfile: boolean;
  /** The role picked on the sheet. Only matters for a new seller. */
  role: SignInRole;
  next: string | null;
  paths: LandingPaths;
}

/**
 * Pure rules for the first screen after a code sign-in (H7.2b):
 * staff go to the admin area; a returning seller goes to the seller panel; a new seller does the seller profile once,
 * then the ad form; a user goes to the user panel. A same-origin return address always wins over the panel,
 * except that a new seller still does the profile first.
 */
export function landingFor(input: LandingInput): string {
  const next = safeNext(input.next);
  if (isStaffRole(input.roles)) return next ?? "/admin/";
  if (!input.hasSellerProfile && input.role === "seller") {
    return `${input.paths.sellerProfile}?next=${encodeURIComponent(next ?? input.paths.postAd)}`;
  }
  if (next) return next;
  return input.hasSellerProfile ? input.paths.seller : input.paths.user;
}
