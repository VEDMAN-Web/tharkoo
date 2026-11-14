import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SellerProfileForm } from "@/components/auth/SellerProfileForm";
import { safeNext } from "@/lib/ui/api";
import { loginPath, postAdPath } from "@/lib/urls";
import { withUrlSeo } from "@/lib/seo/override";
import { SESSION_COOKIE } from "@/server/auth/http";
import { userFromToken } from "@/server/auth/service";
import { newDesignOn } from "@/server/site-links/new-design";
import { getPaths } from "@/server/urls/service";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return withUrlSeo("/u/seller-profile/", {
    title: "Seller profile | Tharkoo",
    description: "Set up your seller profile before you post your first ad.",
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
  return (
    <SellerProfileForm
      next={next}
      initial={user.seller}
      askDateOfBirth={!user.dateOfBirth}
    />
  );
}
