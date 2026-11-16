import type { CtaCopy, PostCopy, StepCopy } from "./copy";
import type { NewPostStep } from "@/lib/ui/post-form";

const STEP_KEYS: Record<NewPostStep, keyof PostCopy["steps"]> = {
  category: "basics",
  details: "details",
  photos: "photos",
  contact: "contact",
  review: "review",
};

export const ABOUT_YOU_TITLE = "About you";
export const ABOUT_YOU_HELP = "This shows on your ads. We ask only once, next time it is filled in for you.";

const CONTACT_DEFAULT_TITLE = "Your contacts";
const CONTACT_TITLE = "Contact";
const CONTACT_HELP = "Add the phone number people can reach you on.";
const REVIEW_DEFAULT_TITLE = "Publish";
const REVIEW_TITLE = "Check your ad";
const REVIEW_HELP = "Look it over. Use Edit to change anything before it goes live.";
const LEGACY_PUBLISH = "PUBLISH";
const PUBLISH_LABEL = "Publish ad";

export function newStepCopy(step: NewPostStep, copy: PostCopy, aboutYou: boolean): StepCopy {
  const base = copy.steps[STEP_KEYS[step]];
  if (step === "contact") {
    const edited = base.title !== CONTACT_DEFAULT_TITLE && base.title !== "";
    if (aboutYou) {
      return { ...base, title: edited ? base.title : ABOUT_YOU_TITLE, help: base.help || ABOUT_YOU_HELP };
    }
    return { ...base, title: edited ? base.title : CONTACT_TITLE, help: base.help || CONTACT_HELP };
  }
  if (step === "review") {
    const edited = base.title !== REVIEW_DEFAULT_TITLE && base.title !== "";
    return {
      ...base,
      title: edited ? base.title : REVIEW_TITLE,
      help: base.help || REVIEW_HELP,
      nextLabel: !base.nextLabel || base.nextLabel === LEGACY_PUBLISH ? PUBLISH_LABEL : base.nextLabel,
    };
  }
  return base;
}

const LEGACY_SUCCESS_LABEL = "Your ads";
const SUCCESS_LABEL = "View my ads";
const SUCCESS_ANOTHER = "Post another ad";
const MY_ADS_PATH = "/u/account/ads/";

export type SuccessCopy = {
  title: string;
  text: string;
  primary: CtaCopy;
  secondary: CtaCopy;
};

export function newSuccessCopy(copy: PostCopy, live: boolean): SuccessCopy {
  const { title, text, primaryCta, secondaryCta } = copy.success;
  const primary = primaryCta && primaryCta.label !== LEGACY_SUCCESS_LABEL ? primaryCta : { label: SUCCESS_LABEL, href: primaryCta?.href || MY_ADS_PATH };
  const secondary = secondaryCta ?? { label: SUCCESS_ANOTHER, href: "" };
  return { title: live ? title : "Your ad is in review", text, primary, secondary };
}
