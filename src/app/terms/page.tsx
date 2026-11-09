import { StaticPage } from "@/components/StaticPage";
export const metadata = { title: "Terms" };
export default function Terms() {
  return (
    <StaticPage title="Terms of use">
      <p>Draft terms for the Tharkoo public beta. Replace with counsel-approved text before launch (PRD §22).</p>
      <p>You must be 18 or older. Do not post illegal content, stolen photos, or contact details in images.</p>
    </StaticPage>
  );
}
