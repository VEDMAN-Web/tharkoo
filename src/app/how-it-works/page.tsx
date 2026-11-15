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

const FIRST_ANSWER = "Yes. Posting, chatting and calling the seller are free. Only video calls and optional boosts use coins.";
const ANSWER_PLACEHOLDER = "Answer to be added.";

const QUESTIONS = [
  "Is posting really free?",
  "Do I need a password?",
  "How does the video call work?",
  "How long does my ad stay live?",
  "How do I report a fake ad?",
];

function packsText(prices: number[]) {
  if (!prices.length) return "Packs from ₹99";
  return `Packs from ₹${Math.min(...prices).toLocaleString("en-IN")}`;
}

export default async function HowItWorksPage() {
  const [packs, paths] = await Promise.all([getCreditPacks().catch(() => []), getPaths()]);
  const prices = packs.map((pack) => pack.price).filter((price): price is number => typeof price === "number" && Number.isFinite(price) && price > 0);
  const faqs = QUESTIONS.map((q, index) => ({ q, a: index === 0 ? FIRST_ANSWER : ANSWER_PLACEHOLDER }));
  return <HowItWorksView postAdHref={postAdPath(paths)} faqs={faqs} packsText={packsText(prices)} />;
}
