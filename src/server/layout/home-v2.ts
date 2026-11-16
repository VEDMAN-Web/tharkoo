import { makeT, type UiTextMap } from "@/lib/ui/text";
import type { Hero } from "@/components/new/home-blocks/types";
import type { BlockBase } from "@/server/models/layout";
import type { ShellConfig } from "@/server/site-links/shell-config-rules";

export interface HomeV2Source {
  hero: Hero;
  shell: Pick<ShellConfig, "home">;
  texts: UiTextMap;
  categoriesCount?: number;
}

function imageOf(src: string, alt: string, width?: number, height?: number) {
  return { src, alt, ...(width && height ? { width, height } : {}) };
}

function focusOf(x: number | undefined, y: number | undefined) {
  return x === undefined && y === undefined ? undefined : { x: x ?? 50, y: y ?? 25 };
}

/** The format 2 home blocks that render the same page as NewHome for the same data. */
export function homeBlocksFrom(source: HomeV2Source): BlockBase[] {
  const { hero, shell, texts } = source;
  const t = makeT(texts);
  const focus = focusOf(hero.focusX, hero.focusY);
  const phoneFocus = focusOf(hero.phoneFocusX, hero.phoneFocusY);
  return [
    {
      id: "home-banner",
      type: "homeBanner",
      visible: true,
      props: {
        ...(hero.photo ? { imageDesktop: imageOf(hero.photo, hero.photoAlt, hero.photoWidth, hero.photoHeight) } : {}),
        ...(hero.photoPhone ? { imageMobile: imageOf(hero.photoPhone, hero.photoAlt) } : {}),
        ...(focus ? { focus } : {}),
        ...(phoneFocus ? { phoneFocus } : {}),
        h1: hero.desktop,
        textInImage: hero.textInImage === true,
        subline: t("home.banner.sub"),
        showSearch: true,
      },
    },
    { id: "home-trust", type: "homeTrust", visible: true, props: { items: shell.home.trust.map((pill) => ({ label: pill.label })) } },
    {
      id: "home-categories",
      type: "homeCategories",
      visible: true,
      props: { eyebrow: t("home.cats.eyebrow"), title: t("home.cats.title"), allText: t("home.cats.all"), count: Math.min(8, Math.max(1, source.categoriesCount ?? 4)), source: "catalogue", picked: [] },
    },
    {
      id: "home-ads",
      type: "homeAds",
      visible: true,
      props: { eyebrow: t("home.ads.eyebrow"), title: t("home.ads.title", { city: "{city}" }), moreText: t("home.ads.all"), listLabel: t("home.ads.list") },
    },
    {
      id: "home-steps",
      type: "homeSteps",
      visible: true,
      props: { eyebrow: t("home.steps.eyebrow"), title: t("home.steps.title"), items: shell.home.steps.map((step) => ({ title: step.title, text: step.text })) },
    },
  ];
}
