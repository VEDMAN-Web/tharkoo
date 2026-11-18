import type { TextFn } from "@/lib/ui/text";
import type { HomeAdLabels } from "../HomeAdCard";

export function cardLabelsOf(t: TextFn): HomeAdLabels {
  return {
    online: t("home.ads.online"),
    watermark: t("home.ads.watermark"),
    photoPrev: t("home.ads.photoPrev"),
    photoNext: t("home.ads.photoNext"),
    chat: t("home.ads.chat"),
    age: t("home.ads.age"),
  };
}

export function searchLabelsOf(t: TextFn) {
  return {
    state: t("home.search.state"),
    city: t("home.search.city"),
    category: t("home.search.category"),
    allStates: t("home.search.allStates"),
    allCities: t("home.search.allCities"),
    allCategories: t("home.search.allCategories"),
    button: t("home.search.button"),
  };
}
