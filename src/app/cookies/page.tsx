import { StaticPage } from "@/components/StaticPage";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Cookie notice | Tharkoo",
  description: "The cookies Tharkoo uses to keep you signed in and remember choices.",
  path: "/cookies/",
});

export default function Page() {
  return (
    <StaticPage title="Cookie notice">
      <p>A sign-in cookie keeps your session. A second, readable flag lets the site skip account requests when you are logged out. Your browser also remembers the age confirmation, cookie choice, saved ads, and chosen city.</p>
      <p>You can keep only the necessary cookies from the banner on your first visit.</p>
    </StaticPage>
  );
}