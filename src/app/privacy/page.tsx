import { StaticPage } from "@/components/StaticPage";
export const metadata = { title: "Privacy" };
export default function Privacy() {
  return (
    <StaticPage title="Privacy policy">
      <p>
        Tharkoo stores account, listing and payment-ledger data in MongoDB on infrastructure you control
        (DigitalOcean in production). Contact buttons send buyers off-site. Email addresses are relayed, never shown.
      </p>
      <p>This is a draft for development. Replace before processing real personal data.</p>
    </StaticPage>
  );
}
