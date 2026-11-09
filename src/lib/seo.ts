import { siteUrl } from "./utils";

export type SeoVars = {
  category?: string;
  city?: string;
  state?: string;
  district?: string;
  districtPref?: string;
  title?: string;
  count?: number;
  year?: number;
  site?: string;
};

export function fillTemplate(template: string, vars: SeoVars) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = vars[key as keyof SeoVars];
    return value === undefined || value === null ? "" : String(value);
  });
}

export const DEFAULT_SEO = {
  home: {
    pageType: "home",
    title: "Escort service and Adult meetings in India - Tharkoo",
    description: "Tharkoo #1 Adult Classifieds in India. Browse Call Girls, Massages, Male Escorts, Transsexual and Adult Meetings. Post your ad absolutely FREE.",
    h1: "Hot meetings in your city",
    h2: "Find your favourite Escort in Tharkoo",
    intro: "Welcome to Tharkoo, #1 Adult Classifieds in India. Are you looking for escort service? Browse massages, sexual meetings, escorts, independent escorts, call boys, transsexual ads and Adult Meetings. Cannot find what you're looking for? POST YOUR AD absolutely FREE!",
    footer: "New cities open over time. Posting is free within weekly limits; paid bumps move an ad to the top of the feed.",
  },
  category: {
    pageType: "category",
    title: "{category} ads in India | {site}",
    description: "Browse {category} listings across Indian cities. Filter by city and district.",
    h1: "{category} in India",
    h2: "All cities",
    intro: "Open a city page to see live {category} ads, ranked by the latest bump.",
    footer: "Thin city pages stay reachable and gain an index tag once they have enough live ads.",
  },
  location: {
    pageType: "location",
    title: "{category} in {city}{districtPref} | {site}",
    description: "{count} {category} listings in {city}. Call, WhatsApp or Telegram the vendor directly.",
    h1: "{category} {city}{districtPref}",
    h2: "Latest ads in {city}",
    intro: "Live {category} ads in {city}. Promoted ads sit at the top during their time slot.",
    footer: "See nearby cities if this page is still filling up.",
  },
  ad: {
    pageType: "ad",
    title: "{title} — {city} {category} | {site}",
    description: "{title} in {city}. Contact the vendor on the channels they enabled.",
    h1: "{title}",
    h2: "",
    intro: "",
    footer: "",
  },
};

export function canonical(path: string) {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
