import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PostWizard } from "@/components/PostWizard";
import { buildPostCopy } from "@/components/post/copy";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { getPageBlocks, inWindow } from "@/lib/layout/read";
import { isAdminRole } from "@/lib/ui/site-content";
import { getDraft } from "@/server/layout/service";
import { loginPath, postAdPath } from "@/lib/urls";
import { withUrlSeo } from "@/lib/seo/override";
import { userFromToken } from "@/server/auth/service";
import { SESSION_COOKIE } from "@/server/auth/http";
import { newDesignOn } from "@/server/site-links/new-design";
import { getPaths } from "@/server/urls/service";
import { idCheckRequired, idCheckScreen } from "@/server/settings/id-check";
import { IdCheckFirst } from "@/components/post/IdCheckFirst";
import { getCategories, getCities } from "@/lib/queries";
import { plain } from "@/lib/plain";
import { kindFor } from "@/server/categories/kind";

export async function generateMetadata() {
  const paths = await getPaths();
  return withUrlSeo(postAdPath(paths), {
    title: "Post an ad | Tharkoo",
    description: "Save a Tharkoo listing draft and submit it for review.",
    path: postAdPath(paths),
    index: false,
  });
}

export default async function PostInsertPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await userFromToken(token);
  const params = await searchParams;
  const paths = await getPaths();
  const query = new URLSearchParams();
  for (const key of ["draft", "step"] as const) {
    const value = params[key];
    if (typeof value === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value)) query.set(key, value);
  }
  const dest = query.size ? `${postAdPath(paths)}?${query.toString()}` : postAdPath(paths);
  if (!session) redirect(`${loginPath(paths)}?role=seller&next=${encodeURIComponent(dest)}`);
  // H7.2b (New design): a seller profile is asked once, before the first ad. A returning seller skips it.
  const newDesign = await newDesignOn();
  if (!session.user.seller && newDesign) redirect(`/u/seller-profile/?next=${encodeURIComponent(dest)}`);
  // H6.14: with the ID-check switch on, the ID check comes first, before step 1. Off, the form always opens.
  const requireIdCheck = await idCheckRequired();
  const screen = idCheckScreen(requireIdCheck, session.user.verificationStatus);
  if (screen !== "form") return <IdCheckFirst screen={screen} postPath={postAdPath(await getPaths())} />;
  let blocks = null;
  try {
    // "?preview=1" shows an admin the saved draft instead of the published layout.
    if (params.preview === "1" && isAdminRole((await getStaffFromHeaders()).roles)) {
      const now = new Date();
      blocks = ((await getDraft("post", "default")) ?? []).filter((block) => block.visible && inWindow(block, now));
    } else blocks = await getPageBlocks("post", ["default"]);
  } catch (error) {
    console.error("post-ad layout could not be read; using the built-in wording", error);
  }
  // H7.5: the New design (five steps, live preview) only when the switch is on.
  const [categoryRows, cityRows] = newDesign ? await Promise.all([getCategories(), getCities()]) : [[], []];
  const categories = plain(
    categoryRows.map((row) => ({
      _id: String(row._id),
      name: row.name,
      slug: row.slug,
      people: row.kind === "people" || kindFor(row.slug, row.fields) === "people",
      fields: row.fields,
    })),
  );
  const cities = plain(cityRows.map((row) => ({ id: row.id, name: row.name, slug: row.slug })).sort((a, b) => a.name.localeCompare(b.name)));
  return <PostWizard copy={buildPostCopy(blocks)} requireIdCheck={requireIdCheck} newDesign={newDesign} initialCategories={categories} initialCities={cities} />;
}
