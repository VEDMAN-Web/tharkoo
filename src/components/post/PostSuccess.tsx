import Link from "next/link";
import { CircleCheck, Clock } from "lucide-react";
import type { ListingDoc } from "@/lib/models";
import { openSupportWith } from "@/components/recharge/openRecharge";
import { creditsText } from "./credits";
import type { SuccessCopy } from "./newCopy";
import { PostPreviewCard } from "./PostPreview";

export type UpsellPlan = { id: string; name: string; amount?: number };

type Props = {
  copy: SuccessCopy;
  live: boolean;
  where: string;
  ad: ListingDoc;
  hasPhoto: boolean;
  byline: string;
  anotherHref: string;
  adHref: string;
  receipt: string;
  plans: UpsellPlan[];
  planNote: string;
  onPlan: (plan: UpsellPlan) => void;
  /** H7.118: an edit of a posted ad was saved. No fee, no upsell. */
  saved?: boolean;
  paused?: boolean;
};

function nextSteps(live: boolean, where: string, saved = false, paused = false): string[] {
  if (saved) {
    return [
      paused ? "It is still paused. Resume it in My ads when you are ready." : "Your changes are on your ad now.",
      "See views and replies in My ads.",
      "Pause, renew or promote it any time.",
    ];
  }
  if (live) {
    return [
      where ? `People can find it on the ${where} page now.` : "People can find it on the site now.",
      "See views and replies in My ads.",
      "Edit, pause or renew it any time.",
    ];
  }
  return ["We check every ad before it goes live.", "You will see the result in My ads.", "You can still edit it while you wait."];
}

export function PostSuccess({ copy, live, where, ad, hasPhoto, byline, anotherHref, adHref, receipt, plans, planNote, onPlan, saved = false, paused = false }: Props) {
  const Mark = live ? CircleCheck : Clock;
  return (
    <div className="tkp-post" data-design="post-new" data-tk="post-success" data-state={saved ? "saved" : live ? "live" : "review"}>
      <div className="tkp-progress" aria-hidden><i style={{ width: "100%" }} /></div>
      <section className="tkp-success" aria-labelledby="post-success-title">
        <span className="tkp-success-mark" aria-hidden><Mark size={32} focusable="false" /></span>
        <h1 id="post-success-title" className="tkp-h1" data-tk="step-title">{copy.title}</h1>
        {copy.text ? <p className="tkp-help">{copy.text}</p> : null}
        <div className="tkp-success-cols">
          <div className="tkp-success-col">
            <div className="tkp-success-card">
              <PostPreviewCard ad={ad} label="Your ad" hasPhoto={hasPhoto} byline={byline} />
            </div>
            <ul className="tkp-next" data-tk="what-next">
              {nextSteps(live, where, saved, paused).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div className="tkp-success-col">
            {receipt ? <p className="tkp-receipt" data-tk="receipt">{receipt}</p> : null}
            {adHref && live && !paused ? <Link href={adHref} className="tkp-ad-link" data-tk="view-ad">View your ad</Link> : null}
            {plans.length && !saved ? (
              <section className="tkp-upsell" data-tk="upsell" aria-label="Get more views">
                <h2 className="tkp-upsell-title">Get more views</h2>
                <ul className="tkp-upsell-list">
                  {plans.map((plan) => (
                    <li key={plan.id}>
                      <span className="tkp-upsell-name">{plan.name}</span>
                      <span className="tkp-upsell-price">{typeof plan.amount === "number" ? creditsText(plan.amount) : ""}</span>
                      <button type="button" className="tkp-btn tkp-btn-small" data-tk="upsell-plan" onClick={() => onPlan(plan)}>
                        {`Get ${plan.name}`}
                      </button>
                    </li>
                  ))}
                </ul>
                {planNote ? <p className="tkp-upsell-note" role="status" data-tk="upsell-note">{planNote}</p> : null}
              </section>
            ) : null}
            <div className="tkp-success-actions">
              <Link href={copy.primary.href} className="tkp-btn tkp-btn-primary" data-tk="view-my-ads">{copy.primary.label}</Link>
              <a href={anotherHref} className="tkp-btn" data-tk="post-another">{copy.secondary.label}</a>
            </div>
            <button type="button" className="tkp-help-link" data-tk="success-help" onClick={() => openSupportWith("")}>Need help? Chat with us</button>
          </div>
        </div>
      </section>
    </div>
  );
}
