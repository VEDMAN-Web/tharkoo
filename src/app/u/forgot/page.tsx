import { AuthForm } from "@/components/AuthForm";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Forgot password | Tharkoo",
  description: "Request a password reset for Tharkoo.",
  path: "/u/forgot/",
  index: false,
});

export default function Page() {
  return <AuthForm mode="forgot" />;
}
