import { getCreditPacks } from "@/lib/queries";
import { TRUST } from "@/content/trust";
import { pageMetadata } from "@/lib/ui/meta";
import { getPaths } from "@/server/urls/service";
import { postAdPath } from "@/lib/urls";
import { HowItWorksView } from "@/components/h714/HowItWorksView";

const copy = TRUST["how-it-works"];

export const revalidate = 300;

export const metadata = pageMetadata({
  title: "How Tharkoo works: posting, browsing and contacting | Tharkoo",
  description: copy.description,
  path: "/how-it-works/",
});

const FAQS = [
  {
    q: "Is posting really free?",
    a: "Yes. Posting, chatting and calling the seller are free. Only video calls and optional boosts use coins.",
  },
  {
    q: "Do I need a password?",
    a: "No. Enter your email and we send you a 6-digit code. Type it in and you are logged in. Nothing to remember.",
  },
  {
    q: "How does the video call work?",
    a: "Tap Video call on an ad. It uses coins and connects you live with the person who posted, so you can see the item, place or person is real before you meet or pay.",
  },
  {
    q: "How long does my ad stay live?",
    a: "72 hours from the time it goes live. After that it ends on its own; you can renew it from My ads in one tap.",
  },
  {
    q: "How do I report a fake ad?",
    a: "Open the ad and tap Report. Pick the reason and send. Our team checks every report and removes ads that break the rules.",
  },
];

function packsText(prices: number[]) {
  if (!prices.length) return "Packs from ₹99";
  return `Packs from ₹${Math.min(...prices).toLocaleString("en-IN")}`;
}

export default async function HowItWorksPage() {
  const [packs, paths] = await Promise.all([getCreditPacks().catch(() => []), getPaths()]);
  const prices = packs.map((pack) => pack.price).filter((price): price is number => typeof price === "number" && Number.isFinite(price) && price > 0);
  return <HowItWorksView postAdHref={postAdPath(paths)} faqs={FAQS} packsText={packsText(prices)} />;
}
