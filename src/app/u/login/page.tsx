import { SignInSheet } from "@/components/auth/SignInSheet";
import { AuthForm } from "@/components/AuthForm";
import { loginPath } from "@/lib/urls";
import { withUrlSeo } from "@/lib/seo/override";
import { smsDeliverable } from "@/server/auth/otp";
import { landingPathsFor } from "@/server/auth/landing-paths";
import { newDesignOn } from "@/server/site-links/new-design";
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

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!(await newDesignOn())) return <AuthForm mode="login" />;
  const params = await searchParams;
  const role = params.role === "seller" ? "seller" : "user";
  const next = typeof params.next === "string" ? params.next : null;
  return (
    <SignInSheet
      mode="page"
      initialRole={role}
      initialNext={next}
      landing={landingPathsFor(await getPaths())}
      showMobile={smsDeliverable()}
    />
  );
}
