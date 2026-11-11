import { AuthForm } from "@/components/AuthForm";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Reset password | Tharkoo",
  description: "Choose a new Tharkoo password.",
  path: "/u/reset/",
  index: false,
});

export default function Page() {
  return <AuthForm mode="reset" />;
}
