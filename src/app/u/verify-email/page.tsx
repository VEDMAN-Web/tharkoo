import { AuthForm } from "@/components/AuthForm";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Confirm email | Tharkoo",
  description: "Confirm your Tharkoo email address.",
  path: "/u/verify-email/",
  index: false,
});

export default function Page() {
  return <AuthForm mode="verify" />;
}
