import type { ShellConfig } from "@/server/site-links/shell-config-rules";
import type { CountryPlaces } from "@/server/locations/site-country";
import type { ListingDoc } from "@/lib/models";
import type { UrlPaths } from "@/lib/urls";
import type { UiTextMap } from "@/lib/ui/text";

export type Cat = { slug?: string; name?: string; homeBlurb?: string; description?: string; icon?: string; kind?: string };

export type Hero = {
  photo: string;
  photoPhone?: string;
  photoAlt: string;
  desktop: string;
  searchPlaceholder: string;
  focusX?: number;
  focusY?: number;
  phoneFocusX?: number;
  phoneFocusY?: number;
  textInImage?: boolean;
  photoWidth?: number;
  photoHeight?: number;
};

export type HomePost = { title: string; href: string; date?: string };

export type HomeData = {
  categories: Cat[];
  ads: ListingDoc[];
  shell: ShellConfig;
  paths: UrlPaths;
  countries: CountryPlaces[];
  texts: UiTextMap;
  posts?: HomePost[];
};
