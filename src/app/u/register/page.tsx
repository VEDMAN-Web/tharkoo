import { AuthForm } from "@/components/AuthForm";
import { registerPath } from "@/lib/urls";
import { withUrlSeo } from "@/lib/seo/override";
import { getPaths } from "@/server/urls/service";

export async function generateMetadata() {
  const paths = await getPaths();
  return withUrlSeo(registerPath(paths), {
    title: "Create an account | Tharkoo",
    description: "Create a Tharkoo account to post a classified ad and manage it from your dashboard.",
    path: registerPath(paths),
    index: false,
  });
}

export default function Page() {
  return <AuthForm mode="register" />;
}
