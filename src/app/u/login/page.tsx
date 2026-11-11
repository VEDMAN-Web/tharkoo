import { AuthForm } from "@/components/AuthForm";
import { loginPath } from "@/lib/urls";
import { withUrlSeo } from "@/lib/seo/override";
import { getPaths } from "@/server/urls/service";

export async function generateMetadata() {
  const paths = await getPaths();
  return withUrlSeo(loginPath(paths), {
    title: "Log in | Tharkoo",
    description: "Log in to your Tharkoo account to post an ad, see your listings, and manage credits.",
    path: loginPath(paths),
    index: false,
    follow: false,
  });
}

export default function Page() {
  return <AuthForm mode="login" />;
}
