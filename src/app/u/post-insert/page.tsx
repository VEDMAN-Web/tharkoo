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
import { getPaths } from "@/server/urls/service";

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
  if (!session) {
    const query = new URLSearchParams();
    for (const key of ["draft", "step"] as const) {
      const value = params[key];
      if (typeof value === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value)) query.set(key, value);
    }
    const paths = await getPaths();
    const dest = query.size ? `${postAdPath(paths)}?${query.toString()}` : postAdPath(paths);
    redirect(`${loginPath(paths)}?next=${encodeURIComponent(dest)}`);
  }
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
  return <PostWizard copy={buildPostCopy(blocks)} />;
}
