import { AuthForm } from "@/components/AuthForm";
import { ResetCard } from "@/components/auth/ResetCard";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Reset password | Tharkoo",
  description: "Choose a new Tharkoo password.",
  path: "/u/reset/",
  index: false,
});

export default function Page() {
  return (
    <ResetCard>
      <AuthForm mode="reset" />
    </ResetCard>
  );
}
