import Link from "next/link";
import { textOverrides } from "@/app/admin/ui-text/store";
import { HomeBlocksV2 } from "@/components/new/home-blocks/HomeBlocksV2";
import { UiTextProvider } from "@/components/ui/AdCard";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { can } from "@/lib/admin/perms";
import { inWindow } from "@/lib/layout/read";
import { plain } from "@/lib/plain";
import { getCategories, getHomeAds } from "@/lib/queries";
import { pickTexts } from "@/lib/ui/text";
import { buildHomeLayoutBlocks } from "@/server/layout/d1-home";
import { formatOf, getDraft } from "@/server/layout/service";
import { countryPlaces } from "@/server/locations/site-country";
import { readShellConfig } from "@/server/site-links/shell-config";
import { getPaths } from "@/server/urls/service";

export const dynamic = "force-dynamic";

/** The Home page as it will look after Publish, drawn from the saved draft by the same code the live page uses. Admins only. */
export default async function PageBuilderPreview({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const embedded = (await searchParams).embed === "1";
  const identity = await getStaffFromHeaders();
  if (!can(identity.roles, "pages.edit")) return <p style={{ padding: 24 }}>Only an admin can preview the Home page.</p>;
  const saved = (await getDraft("home", "default")) ?? [];
  const draft = formatOf(saved) === 2 ? saved : await buildHomeLayoutBlocks();
  const now = new Date();
  const blocks = draft.filter((block) => block.visible && inWindow(block, now));
  const [overrides, paths, categories, countries, feed, shell] = await Promise.all([textOverrides(), getPaths(), getCategories(), countryPlaces(), getHomeAds(), readShellConfig()]);
  const texts = pickTexts(overrides, "card.", "home.");
  return (
    <UiTextProvider texts={texts}>
      {embedded ? null : (
        <div style={{ position: "sticky", top: 0, zIndex: 50, background: "#fff7e6", borderBottom: "1px solid #f6d79b", padding: "10px 16px", fontSize: 14 }}>
        <strong>Preview of the saved draft.</strong> Visitors see the published version until you press Publish. <Link href="/admin/page-builder/">Back to the Page builder</Link>
        </div>
      )}
      {blocks.length ? (
        <HomeBlocksV2 blocks={blocks} data={{ categories: plain(categories), ads: plain(feed), shell, paths, countries: plain(countries), texts }} />
      ) : (
        <p style={{ padding: 24 }}>The draft has no visible blocks yet.</p>
      )}
    </UiTextProvider>
  );
}
