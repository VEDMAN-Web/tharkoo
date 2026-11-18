import { getCreditPacks } from "@/lib/queries";
import { TRUST } from "@/content/trust";
import { pageMetadata } from "@/lib/ui/meta";
import { getPaths } from "@/server/urls/service";
import { postAdPath } from "@/lib/urls";
import { DEFAULT_AD_LIFETIME_HOURS } from "@/lib/ads/lifetime-rules";
import { HowItWorksView } from "@/components/h714/HowItWorksView";
import { textOverrides } from "@/app/admin/ui-text/store";
import { readMoneySettings } from "@/server/billing/money-settings";
import { makeT } from "@/lib/ui/text";
import { costAnswer } from "@/lib/ui/cost-answer";
import { taggedPicture } from "@/server/layout/page-picture";

const PICTURE_TAG = "how-it-works";

const copy = TRUST["how-it-works"];

export const revalidate = 300;

export const metadata = pageMetadata({
  title: "How Tharkoo works: posting, browsing and contacting | Tharkoo",
  description: copy.description,
  path: "/how-it-works/",
});

const FAQS = [
  {
    q: "Do I need a password?",
    a: "No. Enter your email and we send you a 6-digit code. Type it in and you are logged in. Nothing to remember.",
  },
  {
    q: "How does the video call work?",
    a: "Tap Video call on an ad. It uses credits and connects you live with the person who posted, so you can see the item, place or person is real before you meet or pay.",
  },
  {
    q: "How long does my ad stay live?",
    a: `${DEFAULT_AD_LIFETIME_HOURS} hours from the time it goes live. After that it ends on its own; you can renew it from My ads in one tap.`,
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
  const [packs, paths, money, texts, photo] = await Promise.all([
    getCreditPacks().catch(() => []),
    getPaths(),
    readMoneySettings(),
    textOverrides(),
    taggedPicture(PICTURE_TAG).catch(() => null),
  ]);
  const faqs = [{ q: "What does it cost to post?", a: costAnswer(makeT(texts), money) }, ...FAQS];
  const prices = packs.map((pack) => pack.price).filter((price): price is number => typeof price === "number" && Number.isFinite(price) && price > 0);
  return <HowItWorksView postAdHref={postAdPath(paths)} faqs={faqs} packsText={packsText(prices)} photo={photo} />;
}
