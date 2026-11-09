import { StaticPage } from "@/components/StaticPage";

export const metadata = { title: "About Tharkoo" };

export default function About() {
  return (
    <StaticPage title="About Tharkoo">
      <p>
        Tharkoo is an adult classifieds board for India from SparkBeta Tech, Surat. Same page types as the researched
        reference: home category blocks, city feeds, ad pages, Post your ad. Anyone can browse. Verified vendors post.
        Buyers contact vendors directly. The platform does not take a commission on deals.
      </p>
      <p>Category names are placeholders until the owner fills Appendix B of the PRD.</p>
    </StaticPage>
  );
}
