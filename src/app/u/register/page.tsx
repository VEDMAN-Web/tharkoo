import { AuthForm } from "@/components/AuthForm";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Create an account | Tharkoo",
  description: "Create a Tharkoo account.",
  path: "/u/register/",
  index: false,
});

export default function Page() {
  return <AuthForm mode="register" />;
}
