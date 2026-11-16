import Link from "next/link";
import { CircleCheck, Clock } from "lucide-react";
import type { ListingDoc } from "@/lib/models";
import type { SuccessCopy } from "./newCopy";
import { PostPreviewCard } from "./PostPreview";

type Props = {
  copy: SuccessCopy;
  live: boolean;
  where: string;
  ad: ListingDoc;
  hasPhoto: boolean;
  byline: string;
  anotherHref: string;
};

function nextSteps(live: boolean, where: string): string[] {
  if (live) {
    return [
      where ? `People can find it on the ${where} page now.` : "People can find it on the site now.",
      "See views and replies in My ads.",
      "Edit, pause or renew it any time.",
    ];
  }
  return ["We check every ad before it goes live.", "You will see the result in My ads.", "You can still edit it while you wait."];
}

export function PostSuccess({ copy, live, where, ad, hasPhoto, byline, anotherHref }: Props) {
  const Mark = live ? CircleCheck : Clock;
  return (
    <div className="tkp-post" data-design="post-new" data-tk="post-success" data-state={live ? "live" : "review"}>
      <div className="tkp-progress" aria-hidden><i style={{ width: "100%" }} /></div>
      <section className="tkp-success" aria-labelledby="post-success-title">
        <span className="tkp-success-mark" aria-hidden><Mark size={32} focusable="false" /></span>
        <h1 id="post-success-title" className="tkp-h1" data-tk="step-title">{copy.title}</h1>
        {copy.text ? <p className="tkp-help">{copy.text}</p> : null}
        <div className="tkp-success-card">
          <PostPreviewCard ad={ad} label="Your ad" hasPhoto={hasPhoto} byline={byline} />
        </div>
        <ul className="tkp-next" data-tk="what-next">
          {nextSteps(live, where).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <div className="tkp-success-actions">
          <Link href={copy.primary.href} className="tkp-btn tkp-btn-primary" data-tk="view-my-ads">{copy.primary.label}</Link>
          <a href={anotherHref} className="tkp-btn" data-tk="post-another">{copy.secondary.label}</a>
        </div>
      </section>
    </div>
  );
}
