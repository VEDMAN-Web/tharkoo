import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SellerProfileForm } from "@/components/auth/SellerProfileForm";
import { safeNext } from "@/lib/ui/api";
import { loginPath, postAdPath } from "@/lib/urls";
import { withUrlSeo } from "@/lib/seo/override";
import { SESSION_COOKIE } from "@/server/auth/http";
import { userFromToken } from "@/server/auth/service";
import { readOwnPresence } from "@/server/availability/service";
import { newDesignOn } from "@/server/site-links/new-design";
import { getCities } from "@/lib/queries";
import { getPaths } from "@/server/urls/service";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return withUrlSeo("/u/seller-profile/", {
    title: "About you | Tharkoo",
    description: "Set up your advertiser profile before you post your first ad.",
    path: "/u/seller-profile/",
    index: false,
    follow: false,
  });
}

/** H7.2b: asked once before the first ad. A signed-out visitor signs in first; the old flow has no such step. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const paths = await getPaths();
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null) ?? postAdPath(paths);
  if (!(await newDesignOn())) redirect(next);

  const session = await userFromToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) {
    redirect(`${loginPath(paths)}?role=seller&next=${encodeURIComponent(next)}`);
  }
  const user = session.user;
  const [presence, cityRows] = await Promise.all([readOwnPresence(user.id), getCities()]);
  const cities = cityRows.map((row) => ({ id: row.id, name: row.name, slug: row.slug })).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <SellerProfileForm
      next={next}
      initial={user.seller}
      askDateOfBirth={!user.dateOfBirth}
      initialLiveChat={presence.liveChat}
      cities={cities}
    />
  );
}
