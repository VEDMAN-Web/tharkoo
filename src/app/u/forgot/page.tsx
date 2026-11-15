import { AuthForm } from "@/components/AuthForm";
import { ResetCard } from "@/components/auth/ResetCard";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Forgot password | Tharkoo",
  description: "Request a password reset for Tharkoo.",
  path: "/u/forgot/",
  index: false,
});

export default function Page() {
  return (
    <ResetCard>
      <AuthForm mode="forgot" />
    </ResetCard>
  );
}
