import Link from "next/link";
import { loadHomepageForAdmin } from "@/app/admin/content-actions";
import { AdminShell } from "@/components/admin/AdminShell";
import { Notice } from "@/components/admin/ui/Notice";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { canonical } from "@/lib/seo";
import { isAdminRole } from "@/lib/ui/site-content";
import { HomeSeoSection } from "./HomeSeoSection";
import { ListingBandSwitch } from "./ListingBandSwitch";
import { LoginImageField } from "./LoginImageField";

export const dynamic = "force-dynamic";

/**
 * H8.19: the Home page itself (banner, categories, ads, steps, trust bar) is edited in the Page builder.
 * This screen keeps only what the builder does not own: the Home title and description for search engines,
 * the listing photo band switch and the sign-in picture. The banner and category count are shown here as read-only facts.
 */
export default async function HomepageAdminPage() {
  const identity = await getStaffFromHeaders();
  if (!isAdminRole(identity.roles)) {
    return (
      <AdminShell title="Home page">
        <p>Only an admin can edit the home page.</p>
      </AdminShell>
    );
  }
  const content = await loadHomepageForAdmin();
  return (
    <AdminShell title="Home page">
      <div className="adm-stack" data-tk="home-moved">
        <Notice kind="info" title="The Home page is edited in the Page builder.">
          The banner, categories, ads, How it works and trust bar are blocks you change, reorder and publish there.{" "}
          <Link href="/admin/page-builder/" data-tk="open-builder">Open the Page builder</Link>
        </Notice>
        <section className="adm-card" style={{ padding: 20 }} aria-labelledby="home-now">
          <h2 id="home-now" className="t-h3">What Home shows today (read only)</h2>
          <ul>
            <li>Banner headline: {content.hero.desktop}</li>
            <li>Picture description: {content.hero.photoAlt || "none"}</li>
            <li>Categories shown: {content.homeCategoriesCount}</li>
          </ul>
        </section>
        <HomeSeoSection
          initial={{ seoTitle: content.seoTitle, seoDescription: content.seoDescription }}
          siteLabel={canonical("/").replace(/^https?:\/\//, "")}
        />
        <ListingBandSwitch initial={content.showListingBand} />
        <LoginImageField initial={content.loginImage} focus={{ x: content.loginImageFocusX, y: content.loginImageFocusY }} />
      </div>
    </AdminShell>
  );
}
