import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CheckoutView } from "@/components/recharge/CheckoutView";
import { pageMetadata } from "@/lib/ui/meta";
import { SESSION_COOKIE } from "@/server/auth/http";
import { userFromToken } from "@/server/auth/service";
import { readOwnPayment } from "@/server/billing/recharge";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({ title: "Test payment | Tharkoo", description: "Test payment for Tharkoo credits.", path: "/pay/checkout/", index: false });

export default async function CheckoutPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  const found = await userFromToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!found) redirect(`/u/login/?next=${encodeURIComponent(`/pay/checkout/${paymentId}/`)}`);
  const payment = await readOwnPayment(found.user.id, paymentId).catch(() => null);
  if (!payment) notFound();
  return <CheckoutView payment={payment} />;
}
