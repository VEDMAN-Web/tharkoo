import { CouponRedeem } from "@/components/account/AccountTools";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Coupons | Tharkoo",
  description: "Apply a Tharkoo coupon.",
  path: "/u/account/coupons/",
  index: false,
});

export default function Page() {
  return <CouponRedeem />;
}
