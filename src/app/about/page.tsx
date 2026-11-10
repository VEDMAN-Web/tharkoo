import { StaticPage } from "@/components/StaticPage";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "About Tharkoo | Tharkoo",
  description: "Tharkoo is a classifieds site for homes, work, vehicles, pets, and local notices across India.",
  path: "/about/",
});

export default function About() {
  return (
    <StaticPage title="About Tharkoo">
      <p>
        Tharkoo lists classifieds for people across India. The catalogue covers homes, work, vehicles, pets, learning, and local notices.
      </p>
      <p>Contact details stay hidden until a reader asks to reveal them. Publishing some categories asks for an identity check first.</p>
    </StaticPage>
  );
}
