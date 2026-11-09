import { StaticPage } from "@/components/StaticPage";

export const metadata = { title: "About Tharkoo" };

export default function About() {
  return (
    <StaticPage title="About Tharkoo">
      <p>
        Tharkoo is a city-by-category classifieds board from SparkBeta Tech, Surat. Anyone can browse. Verified
        vendors post. Buyers contact vendors directly. The platform does not take a commission on deals.
      </p>
      <p>Category names are placeholders until the owner fills Appendix B of the PRD.</p>
    </StaticPage>
  );
}
