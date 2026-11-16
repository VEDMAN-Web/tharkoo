import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignInSheet } from "@/components/auth/SignInSheet";
import { AuthForm } from "@/components/AuthForm";
import { loginPath } from "@/lib/urls";
import { withUrlSeo } from "@/lib/seo/override";
import { smsDeliverable } from "@/server/auth/otp";
import { getSite } from "@/lib/queries";
import { readContent } from "@/lib/ui/site-content";
import { newDesignOn } from "@/server/site-links/new-design";
import { getPaths } from "@/server/urls/service";
import { safeNext } from "@/lib/ui/api";
import { SESSION_COOKIE } from "@/server/auth/http";
import { userFromToken } from "@/server/auth/service";

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
  const params = await searchParams;
  const session = await userFromToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (session) redirect(safeNext(typeof params.next === "string" ? params.next : null) ?? "/u/account/");
  if (!(await newDesignOn())) return <AuthForm mode="login" />;
  const site = await getSite();
  const login = readContent((site as { homepage?: unknown } | null)?.homepage);
  const next = typeof params.next === "string" ? params.next : null;
  return (
    <SignInSheet
      mode="page"
      initialNext={next}
      showMobile={smsDeliverable()}
      image={login.loginImage}
      imageFocus={`${login.loginImageFocusX}% ${login.loginImageFocusY}%`}
    />
  );
}
