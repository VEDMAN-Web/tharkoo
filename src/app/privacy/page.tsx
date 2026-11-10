import { StaticPage } from "@/components/StaticPage";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Privacy notice | Tharkoo",
  description: "How Tharkoo handles account and listing information.",
  path: "/privacy/",
});

export default function Page() {
  return (
    <StaticPage title="Privacy notice">
      <p>Tharkoo stores the account details you submit, the listings you post, and the choices you make on this device, such as saved ads and the city you pick.</p>
      <p>Phone numbers on a listing stay off the public page until someone asks to reveal that channel.</p>
    </StaticPage>
  );
}
