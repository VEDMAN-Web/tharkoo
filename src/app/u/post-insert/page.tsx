import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PostWizard } from "@/components/PostWizard";
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
  if (!session) {
    const params = await searchParams;
    const query = new URLSearchParams();
    for (const key of ["draft", "step"] as const) {
      const value = params[key];
      if (typeof value === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value)) query.set(key, value);
    }
    const paths = await getPaths();
    const dest = query.size ? `${postAdPath(paths)}?${query.toString()}` : postAdPath(paths);
    redirect(`${loginPath(paths)}?next=${encodeURIComponent(dest)}`);
  }
  return <PostWizard />;
}
