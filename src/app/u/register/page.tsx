import { AuthForm } from "@/components/AuthForm";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Create an account | Tharkoo",
  description: "Create a Tharkoo account to post a classified ad and manage it from your dashboard.",
  path: "/u/register/",
  index: false,
});

export default function Page() {
  return <AuthForm mode="register" />;
}
