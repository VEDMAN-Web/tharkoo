import { AuthForm } from "@/components/AuthForm";
export const metadata = { title: "Password expired", robots: { index: false } };
export default function Page() {
  return <AuthForm mode="expired" />;
}
