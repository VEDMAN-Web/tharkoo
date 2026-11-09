import { AuthForm } from "@/components/AuthForm";
export const metadata = { title: "Forgot password", robots: { index: false } };
export default function Page() {
  return <AuthForm mode="forgot" />;
}
