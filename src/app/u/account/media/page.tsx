import { ComingSoon } from "@/components/account/AccountTools";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Media | Tharkoo",
  description: "Your photo library will live here.",
  path: "/u/account/media/",
  index: false,
});

export default function Page() {
  return <ComingSoon title="Media" body="Your photo library will live here." href="/u/post-insert/" label="Post an ad" />;
}
