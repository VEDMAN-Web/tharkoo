import { AuthForm } from "@/components/AuthForm";
export const metadata = { title: "Reset password", robots: { index: false } };
export default function Page() {
  return <AuthForm mode="reset" />;
}
