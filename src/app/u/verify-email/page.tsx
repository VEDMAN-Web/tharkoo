import { AuthForm } from "@/components/AuthForm";
export const metadata = { title: "Verify email", robots: { index: false } };
export default function Page() {
  return <AuthForm mode="verify" />;
}
