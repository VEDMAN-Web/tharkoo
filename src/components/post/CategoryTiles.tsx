import { useT } from "@/components/help/UiTextProvider";
import { categoryIcon } from "./categoryIcons";
import "./category-step.css";

export type TileCategory = { _id: string; name: string; slug: string };

const SKELETON_TILES = 11;
/** The three soft tile colours of the design, cycled by position. */
const TONES = ["pink", "lavender", "sky"] as const;

export function CategoryTiles({ categories, selectedId, onPick, locked = false }: { categories: TileCategory[]; selectedId: string; onPick: (id: string) => void; locked?: boolean }) {
  const t = useT();
  if (categories.length === 0) {
    return (
      <div className="tkp-tiles" aria-busy="true" aria-label={t("post.tiles.loading")} role="status">
        {Array.from({ length: SKELETON_TILES }, (_, index) => (
          <span key={index} className="tkp-tile-skel" />
        ))}
      </div>
    );
  }
  return (
    <div className="tkp-tiles" role="group" aria-label={t("post.tiles.label")}>
      {categories.map((cat, index) => {
        const pressed = cat._id === selectedId;
        const Icon = categoryIcon(cat.slug);
        return (
          <button key={cat._id} type="button" className={`tkp-tile ${pressed ? "on" : ""}`} data-tone={TONES[index % TONES.length]} aria-pressed={pressed} disabled={locked && !pressed} onClick={() => onPick(cat._id)}>
            <span className="tkp-tile-tick" aria-hidden="true">
              {pressed ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              ) : null}
            </span>
            <span className="tkp-tile-mark" aria-hidden>
              <Icon size={36} focusable="false" />
            </span>
            <span className="tkp-tile-name">{cat.name}</span>
          </button>
        );
      })}
    </div>
  );
}
