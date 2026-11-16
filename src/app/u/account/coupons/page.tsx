import { CouponRedeem } from "@/components/account/AccountTools";
import { PanelPage } from "@/components/buyer/PanelPage";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Coupons | Tharkoo",
  description: "Apply a Tharkoo coupon.",
  path: "/u/account/coupons/",
  index: false,
});

export default function Page() {
  return (
    <PanelPage active="coins" next="/u/account/coupons/" title="Log in to use a coupon" body="Coupons can be used after you log in.">
      <CouponRedeem />
    </PanelPage>
  );
}
