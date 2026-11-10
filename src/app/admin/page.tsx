import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { connectDb } from "@/lib/db";
import { Category, HelpArticle, Listing, Location, Page, Site, User } from "@/server/models";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  await connectDb();
  const [accounts, ads, live, cats, cities, pages, help, withPhone, site] = await Promise.all([
    User.countDocuments(),
    Listing.countDocuments(),
    Listing.countDocuments({ status: "active" }),
    Category.countDocuments(),
    Location.countDocuments({ type: "city" }),
    Page.countDocuments(),
    HelpArticle.countDocuments(),
    Listing.countDocuments({ "contact.phone": { $exists: true, $nin: [null, ""] } }),
    Site.findOne({ key: "default" }).lean(),
  ]);
  const cards = [
    ["Live ads", live, "/admin/ads/"],
    ["All ads", ads, "/admin/ads/"],
    ["Accounts", accounts, "/admin/users/"],
    ["Ads with a phone", withPhone, "/admin/users/"],
    ["Categories", cats, "/admin/categories/"],
    ["Cities", cities, "/admin/locations/"],
    ["CMS pages", pages, "/admin/cms/"],
    ["Help articles", help, "/admin/help/"],
  ];
  return (
    <AdminShell title="Dashboard">
      <p className="mb-4 t-small text-muted">
        {site?.name || "Tharkoo"} CMS is live. Edit the homepage under{" "}
        <Link href="/admin/cms/" className="text-accent">
          CMS &amp; banners
        </Link>
        . Counts use active listings and city locations.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, n, href]) => (
          <Link key={String(label)} href={String(href)} className="rounded-lg border border-line bg-surface p-4 text-text no-underline">
            <p className="t-small text-muted">{label}</p>
            <p className="t-h2 mt-1">{n}</p>
          </Link>
        ))}
      </div>
    </AdminShell>
  );
}
