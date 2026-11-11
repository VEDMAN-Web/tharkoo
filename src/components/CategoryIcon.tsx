import { PlaceholderArt } from "./ui/PlaceholderArt";

export function CategoryIcon({ slug, name }: { slug: string; color?: string; name: string }) {
  return (
    <div className="size-12 overflow-hidden rounded-md" aria-label={name}>
      <PlaceholderArt seed={slug} category={slug} decorative />
    </div>
  );
}
