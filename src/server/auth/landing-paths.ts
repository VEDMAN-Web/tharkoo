import { postAdPath, type UrlPaths } from "@/lib/urls";
import type { LandingPaths } from "@/components/auth/landing";

/**
 * Landing paths for the sign-in sheet (H7.2b). The post-ad and login addresses follow the URL settings; the panels and
 * the seller profile step are fixed app routes.
 */
export function landingPathsFor(paths: UrlPaths): LandingPaths {
  return {
    user: "/u/account/saved/",
    seller: "/u/account/dashboard/",
    sellerProfile: "/u/seller-profile/",
    postAd: postAdPath(paths),
  };
}
