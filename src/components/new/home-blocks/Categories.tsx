import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { categoryIconFor } from "@/lib/category-icons";
import { applyPrefixes, categoryPath, type UrlPaths } from "@/lib/urls";
import type { ShellConfig } from "@/server/site-links/shell-config-rules";
import { SectionHead } from "./SectionHead";
import type { Cat } from "./types";

const BLURB_MAX = 70;
export const CATS_MAX = 8;

function blurbOf(cat: Cat) {
  const text = (cat.homeBlurb || cat.description || "").replace(/\s+/g, " ").trim();
  return text.length > BLURB_MAX ? `${text.slice(0, BLURB_MAX - 1)}…` : text;
}

export function pickCategories(categories: Cat[], count: number, picked?: string[]): Cat[] {
  const named = categories.filter((cat) => cat.slug && cat.name);
  const chosen = picked && picked.length ? picked.map((slug) => named.find((cat) => cat.slug === slug)).filter((cat): cat is Cat => Boolean(cat)) : named;
  return chosen.slice(0, Math.min(CATS_MAX, Math.max(1, count)));
}

export function HomeCategories({
  eyebrow,
  title,
  allText,
  cats,
  shell,
  paths,
}: {
  eyebrow: string;
  title: string;
  allText: string;
  cats: Cat[];
  shell: ShellConfig;
  paths: UrlPaths;
}) {
  const photos = new Map(shell.media.images.filter((image) => image.scope === "category" && image.photo).map((image) => [image.slug, { src: image.photo, focus: `${image.focusX ?? 50}% ${image.focusY ?? 18}%` }]));
  return (
    <section className="tkh-page tkh-section" aria-labelledby="home-cats">
      <SectionHead id="home-cats" eyebrow={eyebrow} tone="rose" title={title} link={{ href: applyPrefixes("/categories/", paths), text: allText }} />
      <ul className="tkh-cats">
        {cats.map((cat) => {
          const slug = cat.slug || "";
          const photo = photos.get(slug);
          const Icon = categoryIconFor(cat.icon, cat.kind);
          return (
            <li key={slug} data-reveal>
              <Link className="tkh-cat m-lift" href={applyPrefixes(categoryPath(slug), paths)} prefetch={false}>
                {photo ? (
                  <img className="tkh-cat-photo" src={photo.src} alt="" width={480} height={320} loading="lazy" style={{ objectPosition: photo.focus }} />
                ) : (
                  <span className="tkh-cat-photo tkh-cat-empty" aria-hidden="true">
                    <span className="tkh-cat-icon">
                      <Icon size={20} />
                    </span>
                  </span>
                )}
                <span className="tkh-cat-strip">
                  <span className="tkh-cat-text">
                    <span className="tkh-cat-name">{cat.name}</span>
                    <span className="tkh-cat-line">{blurbOf(cat)}</span>
                  </span>
                  <span className="tkh-cat-arrow" aria-hidden="true">
                    <ArrowRight size={16} />
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
