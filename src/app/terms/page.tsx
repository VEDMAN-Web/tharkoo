import { StaticPage } from "@/components/StaticPage";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Terms of use | Tharkoo",
  description: "The terms for using Tharkoo classifieds.",
  path: "/terms/",
});

export default function Page() {
  return (
    <StaticPage title="Terms of use">
      <p>Tharkoo is for people aged 18 and over. You are responsible for the accuracy of anything you post and for keeping your account to yourself.</p>
      <p>Listings that break the content rules can be removed. Contact details are shown only after a reader chooses to reveal them.</p>
    </StaticPage>
  );
}
