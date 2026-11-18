import { makeT, TEXT_DEFAULTS, type TextFn } from "@/lib/ui/text";
import { POST_COPY_DEFAULTS, type CtaCopy, type PostCopy, type StepCopy } from "./copy";
import type { NewPostStep } from "@/lib/ui/post-form";

const STEP_KEYS: Record<NewPostStep, keyof PostCopy["steps"]> = {
  more: "details",
  category: "basics",
  details: "details",
  photos: "photos",
  contact: "contact",
  review: "review",
};

export const ABOUT_YOU_TITLE = TEXT_DEFAULTS["post.stepCopy.aboutYouTitle"];
export const ABOUT_YOU_HELP = TEXT_DEFAULTS["post.stepCopy.aboutYouHelp"];

const LEGACY_PUBLISH = "PUBLISH";

const isUntouched = (base: StepCopy, stock: StepCopy) => base.title === stock.title && base.help === stock.help && base.backLabel === stock.backLabel;

/**
 * The wording of one step of the five-step form. A block value an admin saved is shown as saved, also when it
 * equals the stock wording. Only a step whose title, help and back label are all still the stock seed (nothing
 * was ever changed there) takes the form's own wording from the site texts.
 */
export function newStepCopy(step: NewPostStep, copy: PostCopy, aboutYou: boolean, people = false, fee = 0, editing = false, contactMode = "both", t: TextFn = makeT()): StepCopy {
  const base = copy.steps[STEP_KEYS[step]];
  if (editing && step === "review") return { ...base, title: t("post.stepCopy.editReviewTitle"), help: t("post.stepCopy.editReviewHelp"), nextLabel: t("post.stepCopy.editSave") };
  if (editing && step === "category") return { ...base, help: t("post.stepCopy.editCategoryNote") };
  if (step === "more") return { ...base, title: people ? t("post.stepCopy.moreAboutYou") : t("post.stepCopy.moreDetails"), help: "", nextLabel: "", backLabel: "" };
  if (step === "category" && fee > 0 && (!base.help || base.help === POST_COPY_DEFAULTS.steps.basics.help)) {
    return { ...base, help: t("post.stepCopy.basicsHelpFee", { fee }) };
  }
  if (step === "contact") {
    const own = base.title !== "" && !isUntouched(base, POST_COPY_DEFAULTS.steps.contact);
    const title = own ? base.title : aboutYou ? t("post.stepCopy.aboutYouTitle") : t("post.stepCopy.contactTitle");
    const fallback = aboutYou ? t("post.stepCopy.aboutYouHelp") : contactMode === "email" ? t("post.stepCopy.contactHelpEmail") : t("post.stepCopy.contactHelp");
    return { ...base, title, help: base.help || fallback };
  }
  if (step === "review") {
    const own = base.title !== "" && !isUntouched(base, POST_COPY_DEFAULTS.steps.review);
    return {
      ...base,
      title: own ? base.title : t("post.stepCopy.reviewTitle"),
      help: base.help || t("post.stepCopy.reviewHelp"),
      nextLabel: !base.nextLabel || base.nextLabel === LEGACY_PUBLISH ? t("post.stepCopy.publishAd") : base.nextLabel,
    };
  }
  return base;
}

export type SuccessCopy = {
  title: string;
  text: string;
  secondary: CtaCopy;
};

export function newSuccessCopy(copy: PostCopy, live: boolean, saved = false, t: TextFn = makeT()): SuccessCopy {
  const { title, text, secondaryCta } = copy.success;
  const secondary = secondaryCta ?? { label: t("post.stepCopy.postAnother"), href: "" };
  if (saved) return { title: t("post.stepCopy.savedTitle"), text: t("post.stepCopy.savedText"), secondary };
  return { title: live ? title : t("post.stepCopy.inReview"), text, secondary };
}
