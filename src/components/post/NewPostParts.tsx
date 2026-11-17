import type { NewPostStep } from "@/lib/ui/post-form";
import type { UiTextKey } from "@/lib/ui/text";
import { useT } from "@/components/help/UiTextProvider";

type BaseStep = Exclude<NewPostStep, "more">;

/** H7.5: the New design post-ad pieces that do not hold form state: the step rail, the live preview and the tip. */

/** Pastel tiles for the category grid, cycled by position. Colours from the mockup. */
export const CATEGORY_TINTS = [
  { tint: "#FCE4F0", ink: "#A8124F" },
  { tint: "#EDE9FF", ink: "#5B21B6" },
  { tint: "#E0F2FE", ink: "#075985" },
  { tint: "#ECFDF5", ink: "#047857" },
  { tint: "#FDF0F7", ink: "#C2185B" },
] as const;

/** The UI text key of the tip shown beside each step. The words live in the UI text store (H8.35). */
export const NEW_POST_TIP_KEYS: Record<BaseStep, UiTextKey> = {
  category: "post.tip.category",
  details: "post.tip.details",
  photos: "post.tip.photos",
  contact: "post.tip.contact",
  review: "post.tip.review",
};

export const RAIL_MORE_KEY: UiTextKey = "post.rail.more";

export const RAIL_LABEL_KEYS: Record<BaseStep, UiTextKey> = {
  category: "post.rail.category",
  details: "post.rail.details",
  photos: "post.rail.photos",
  contact: "post.rail.contact",
  review: "post.rail.review",
};

export type RailItem = { key: NewPostStep; label: string; num: number; state: "done" | "current" | "todo"; clickable: boolean };

export function PostRail({ items, progressLabel, onGo, head, children }: { items: RailItem[]; progressLabel: string; onGo: (num: number) => void; head?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <nav aria-label={progressLabel} className="tkp-rail">
      {head}
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
              <span className="tkp-step-label">{item.label}</span>
            </button>
          </li>
        ))}
      </ol>
      {children}
    </nav>
  );
}

export function PostTip({ text }: { text: string }) {
  const t = useT();
  return (
    <div className="tkp-tip">
      <p className="tkp-tip-title">{t("post.tip.title")}</p>
      <p className="tkp-tip-text">{text}</p>
    </div>
  );
}
