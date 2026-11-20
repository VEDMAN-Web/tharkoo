import { permanentRedirect } from "next/navigation";

/** H17.14: /grievance-officer/ is another name for the Grievance Officer page. It is a permanent redirect; the page itself is edited in the CMS. */
export default function Page() {
  permanentRedirect("/cms/grievance/");
}
