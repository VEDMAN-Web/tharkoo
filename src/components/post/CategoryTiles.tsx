import { CATEGORY_TINTS } from "./NewPostParts";
import { categoryIcon } from "./categoryIcons";

export type TileCategory = { _id: string; name: string; slug: string };

const SKELETON_TILES = 11;

export function CategoryTiles({ categories, selectedId, onPick }: { categories: TileCategory[]; selectedId: string; onPick: (id: string) => void }) {
  if (categories.length === 0) {
    return (
      <div className="tkp-tiles" aria-busy="true" aria-label="Loading categories" role="status">
        {Array.from({ length: SKELETON_TILES }, (_, index) => (
          <span key={index} className="tkp-tile-skel" />
        ))}
      </div>
    );
  }
  return (
    <div className="tkp-tiles" role="group" aria-label="Category">
      {categories.map((cat, index) => {
        const pressed = cat._id === selectedId;
        const tint = CATEGORY_TINTS[index % CATEGORY_TINTS.length];
        const Icon = categoryIcon(cat.slug);
        return (
          <button key={cat._id} type="button" className={`tkp-tile ${pressed ? "on" : ""}`} aria-pressed={pressed} onClick={() => onPick(cat._id)}>
            <span className="tkp-tile-mark" style={{ background: tint.tint, color: tint.ink }} aria-hidden>
              <Icon size={20} focusable="false" />
            </span>
            <span className="tkp-tile-name">{cat.name}</span>
          </button>
        );
      })}
    </div>
  );
}
