import { PostWizard } from "@/components/PostWizard";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Post an ad | Tharkoo",
  description: "Save a Tharkoo listing draft and submit it for review.",
  path: "/u/post-insert/",
  index: false,
});

export default function PostInsertPage() {
  return <PostWizard />;
}
