import { AuthForm } from "@/components/AuthForm";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Password expired | Tharkoo",
  description: "Set a new Tharkoo password.",
  path: "/u/password-expired/",
  index: false,
});

export default function Page() {
  return <AuthForm mode="expired" />;
}
