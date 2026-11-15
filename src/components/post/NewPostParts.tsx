import type { NewPostStep } from "@/lib/ui/post-form";

/** H7.13 (P5): the New design post-ad pieces that do not hold form state: the step rail, the live preview and the tip. */

/** Pastel tiles for the category grid, cycled by position. Colours from the v2 mockup (05-PostAd). */
export const CATEGORY_TINTS = [
  { tint: "#FDE7F2", ink: "#A8124F" },
  { tint: "#EDE9FF", ink: "#5B21B6" },
  { tint: "#E0F2FE", ink: "#075985" },
  { tint: "#ECFDF5", ink: "#047857" },
  { tint: "#FFF5E6", ink: "#B45309" },
] as const;

/** Rail labels and the heading of each step, copied from the v2 mockup. Steps 2 to 5 have no mockup: their wording is ours. */
export const NEW_POST_STEP_TEXT: Record<NewPostStep, { label: string; line: string; heading: string; help: string }> = {
  category: {
    label: "Category",
    line: "What are you posting?",
    heading: "What are you posting?",
    help: "Pick a category and a sub-category. This helps the right people find your ad.",
  },
  details: {
    label: "Details",
    line: "Title, price, place",
    heading: "Tell buyers about it",
    help: "A clear title, a fair price and the place help people find your ad.",
  },
  photos: {
    label: "Photos & videos",
    line: "Add many at once",
    heading: "Add photos and videos",
    help: "Up to 10 photos and videos. The first photo is your cover.",
  },
  contact: {
    label: "Contact",
    line: "How buyers reach you",
    heading: "How buyers reach you",
    help: "Choose how people can contact you about this ad.",
  },
  review: {
    label: "Review",
    line: "Check and publish",
    heading: "Check and publish",
    help: "Check your ad. You can go back to any step and change it.",
  },
};

/** Default tips shown beside each step. The wording is a code default; it is not a published block. */
export const NEW_POST_TIPS: Record<NewPostStep, string> = {
  category: "Choosing the right sub-category puts your ad on the pages people search.",
  details: "Short titles work best. Put the most important word first.",
  photos: "Bright photos taken in daylight look best on the listing page.",
  contact: "Ads with WhatsApp turned on are easier to reply to.",
  review: "You can edit your ad any time from your panel.",
};

export type RailItem = { key: NewPostStep; label: string; line: string; num: number; state: "done" | "current" | "todo"; clickable: boolean };

export function PostRail({ items, progressLabel, onGo }: { items: RailItem[]; progressLabel: string; onGo: (num: number) => void }) {
  return (
    <nav aria-label={progressLabel} className="tkp-rail">
      <p className="tkp-kicker tkp-kicker-plain">{progressLabel}</p>
      <ol className="tkp-steps">
        {items.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              className={`tkp-step tkp-step-${item.state}`}
              aria-current={item.state === "current" ? "step" : undefined}
              disabled={!item.clickable}
              onClick={() => onGo(item.num)}
            >
              <span className="tkp-step-dot" aria-hidden>
                {item.state === "done" ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                ) : (
                  item.num
                )}
              </span>
              <span className="tkp-step-text">
                <span className="tkp-step-label">{item.label}</span>
                <span className="tkp-step-line">{item.line}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** The live preview: what the ad card will look like, from the values typed so far. Matches the mockup card. */
export function PostPreviewCard({ title, category, place, price, previewLabel }: { title: string; category: string; place: string; price: string; previewLabel: string }) {
  return (
    <article className="tkp-preview" aria-label={previewLabel}>
      <div className="tkp-preview-photo">
        <span className="tkp-preview-new">New</span>
        <span className="tkp-preview-chat">
          <span aria-hidden />
          Chat online
        </span>
        <span className="tkp-preview-cover">Cover photo</span>
      </div>
      <div className="tkp-preview-body">
        <p className="tkp-preview-title">{title || "Your ad title"}</p>
        <div className="tkp-preview-chips">
          {category ? <span className="tkp-chip-soft tkp-chip-rose">{category}</span> : null}
          {place ? <span className="tkp-chip-soft tkp-chip-violet">{place}</span> : null}
        </div>
        <p className="tkp-preview-price">
          <span>{price || "Price"}</span>
          <span className="tkp-preview-counts">0 views · 0 clicks</span>
        </p>
        <div className="tkp-preview-view">View details</div>
      </div>
    </article>
  );
}

export function PostTip({ text }: { text: string }) {
  return (
    <div className="tkp-tip">
      <p className="tkp-tip-title">Tip</p>
      <p className="tkp-tip-text">{text}</p>
    </div>
  );
}
