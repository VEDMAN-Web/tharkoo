import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { connectDb } from "@/lib/db";
import { Category, HelpArticle, Listing, Location, Page, Site } from "@/lib/models";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  await connectDb();
  const [users, ads, live, cats, cities, pages, help, site] = await Promise.all([
    Listing.distinct("phone").then((x) => x.length),
    Listing.countDocuments(),
    Listing.countDocuments({ status: "live" }),
    Category.countDocuments(),
    Location.countDocuments({ kind: "city" }),
    Page.countDocuments(),
    HelpArticle.countDocuments(),
    Site.findOne({ key: "default" }).lean(),
  ]);
  const cards = [
    ["Live ads", live, "/admin/ads/"],
    ["All ads", ads, "/admin/ads/"],
    ["Phone numbers", users, "/admin/users/"],
    ["Categories", cats, "/admin/categories/"],
    ["Cities", cities, "/admin/locations/"],
    ["CMS pages", pages, "/admin/cms/"],
    ["Help articles", help, "/admin/help/"],
  ];
  return (
    <AdminShell title="Dashboard">
      <p className="mb-4 text-[13px]">
        {site?.name} CMS is live. Edit the entire homepage under{" "}
        <Link href="/admin/cms/">CMS &amp; banners</Link>. Every collection below writes Mongo and shows on the public site.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, n, href]) => (
          <Link key={String(label)} href={String(href)} className="bg-white p-4 no-underline text-[#333]">
            <p className="text-[12px] text-[#777]">{label}</p>
            <p className="text-[28px]">{n}</p>
          </Link>
        ))}
      </div>
    </AdminShell>
  );
}
