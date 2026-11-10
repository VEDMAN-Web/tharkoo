import { AuthForm } from "@/components/AuthForm";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Log in | Tharkoo",
  description: "Log in to your Tharkoo account.",
  path: "/u/login/",
  index: false,
});

export default function Page() {
  return <AuthForm mode="login" />;
}
