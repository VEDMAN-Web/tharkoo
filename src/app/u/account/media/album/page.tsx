import { ComingSoon } from "@/components/account/AccountTools";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Album | Tharkoo",
  description: "Albums are coming soon.",
  path: "/u/account/media/album/",
  index: false,
});

export default function Page() {
  return <ComingSoon title="Album" body="Albums are coming soon." href="/u/account/media/" label="Back to media" />;
}
