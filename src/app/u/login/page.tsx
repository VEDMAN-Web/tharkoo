import { AuthForm } from "@/components/AuthForm";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Log in | Tharkoo",
  description: "Log in to your Tharkoo account to post an ad, see your listings, and manage credits.",
  path: "/u/login/",
  index: false,
  follow: false,
});

export default function Page() {
  return <AuthForm mode="login" />;
}
