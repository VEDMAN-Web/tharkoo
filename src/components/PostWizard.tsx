"use client";

import { trackEvent } from "@/lib/analytics/ga";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { api, fieldErrors, friendlyError, idempotencyKey } from "@/lib/ui/api";
import { PUBLISH_MESSAGES } from "@/lib/ui/publish-errors";
import { loadPostSubcategories, type PostSubcategory } from "@/server/categories/actions";
import { PhotoStep } from "@/components/post/PhotoStep";
import { PickGroup } from "@/components/post/PickGroup";
import { cleanAttrs, isChipField, LONG_LIST, needsMoreStep, stepFromUrl, stepsFor, urlStepOf, DEFAULT_PICK_LIMIT, draftToForm, errorsForStep, needsIdCheck, picksOf, telegramHandle, textOf, validateContact, validatePost, progressPercent, type NewPostStep, type PostAttrs, type SavedDraft } from "@/lib/ui/post-form";
import { loginPath, postAdPath } from "@/lib/urls";
import { useUrlPaths } from "./UrlPaths";
import { useT } from "./help/UiTextProvider";
import { HelpCard } from "./ui/HelpCard";
import { AdCard } from "./ui/AdCard";
import { BUILT_IN_AGE_FIELD, POST_COPY_DEFAULTS, wizardFields, type CtaCopy, type PostCopy } from "./post/copy";
import { newStepCopy, newSuccessCopy } from "./post/newCopy";
import { SelectField, Switch, TextField } from "./post/FormFields";
import { AboutYouStep } from "./post/AboutYouStep";
import { DetailsPreview, DetailsStep, type EditingPart, type SummaryItem } from "./post/DetailsStep";
import { INTEREST_KEY, popularInterestsOf } from "./post/interests";
import { ReviewStep, type ReviewRow } from "./post/ReviewStep";
import { PostSuccess, type SuccessFacts, type UpsellPlan } from "./post/PostSuccess";
import { openPromote } from "./promote/openPromote";
import { openSupportWith } from "./recharge/openRecharge";
import { BuyCreditsDialog } from "./post/BuyCreditsDialog";
import { PostShell } from "./post/PostShell";
import { CategoryPreview, CategoryPreviewHint, useCategoryPreview } from "./post/CategoryPreview";
import { PhotoGuidelines } from "./post/PhotoGuidelines";
import { VideoCallRow } from "./post/VideoCallRow";
import { EarnPanel } from "./post/EarnPanel";
import { ReviewListPreview, type ListKind } from "./post/ReviewListPreview";
import { costBox, feeNote, formatPhone, freeLeftText, publishLabel } from "./post/money-text";
import { BoostChoice, adCreditsNeeded, adCreditsShort, type BoostChoiceValue } from "./post/BoostChoice";
import { EarnLine, type EarnInfo } from "@/components/vendor/TourInbox";
import { CREDITS_ADDED_EVENT, creditsText, insufficientFrom, openRecharge, shortfallOf, usePostingMoney } from "./post/credits";
import { NEW_POST_TIP_KEYS, PostRail, PostTip, RAIL_LABEL_KEYS, RAIL_MORE_KEY, type RailItem } from "./post/NewPostParts";
import { CategoryTiles } from "./post/CategoryTiles";
import { hintsFor, photoHelp } from "./post/placeholders";
import { listDraftMediaAction } from "./post/mediaActions";
import type { DraftMedia } from "@/server/media/mine";
import { PostPreviewCard, PreviewSheet, previewAd } from "./post/PostPreview";
import { placeChoices } from "@/components/ui/SearchSelect";
import "./post/post-wizard.css";
import type { ListingDoc } from "@/lib/models";

type Cat = { _id: string; name: string; slug: string; people?: boolean; kind?: string; fields?: Record<string, unknown>[] };
type Place = { id: string; name: string; slug: string; parentId?: string | null; stateSlug?: string };

/** Step number of the photo step in each design. `?step=photos` in the URL means this step. */
const OLD_PHOTO_STEP = 2;

function tidy(value: string) {
  return value.replace(/[\s-]/g, "");
}

function normalPhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  return tidy(raw);
}

export function PostWizard({
  copy = POST_COPY_DEFAULTS,
  requireIdCheck = false,
  newDesign = false,
  initialCategories,
  initialCities,
  defaultCityId = "",
  defaultName = "",
  accountName = "",
  adultAccepted = false,
  about = null,
}: {
  copy?: PostCopy;
  requireIdCheck?: boolean;
  /** H7.5: the New design switch. On shows the five-step form with the live preview. Off keeps the three-step form. */
  newDesign?: boolean;
  initialCategories?: Cat[];
  initialCities?: Place[];
  defaultCityId?: string;
  defaultName?: string;
  /** H21.12c: the account's own name, for the preview's initial. */
  accountName?: string;
  /** The account has accepted the 18+ statement before, so the Review step does not ask again. */
  adultAccepted?: boolean;
  maskedEmail?: string;
  about?: { askDateOfBirth: boolean } | null;
}) {
  const t = useT();
  const paths = useUrlPaths();
  const [step, setStep] = useState(1);
  /** H12.4 7: which way the last step change went, so the new step slides in from the right (on) or the left (back). Empty until the first change. */
  const [stepMove, setStepMove] = useState<{ from: number; dir: "" | "fwd" | "back" }>({ from: 1, dir: "" });
  if (stepMove.from !== step) setStepMove({ from: step, dir: step > stepMove.from ? "fwd" : "back" });
  const pendingStep = useRef<string | null>(null);
  const [startReady, setStartReady] = useState(false);
  const [categories, setCategories] = useState<Cat[]>(initialCategories ?? []);
  const [cities, setCities] = useState<Place[]>(initialCities ?? []);
  const [districts, setDistricts] = useState<Place[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [subsByCategory, setSubsByCategory] = useState<Record<string, PostSubcategory[]>>({});
  const [subcategoryId, setSubcategoryId] = useState("");
  const [cityId, setCityId] = useState(defaultCityId);
  /** H19.6: the state the person picked. Until they pick one it is the state of the chosen city. */
  const [pickedState, setPickedState] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [address, setAddress] = useState("");
  const [postal, setPostal] = useState("");
  const [area, setArea] = useState("");
  const [age, setAge] = useState("");
  const [nickname, setNickname] = useState(defaultName.slice(0, 20));
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  /** H21.2: the part of the live preview that lights up, and the count that moves focus to the "Fix N things" box. */
  const [editingPart, setEditingPart] = useState<EditingPart>("");
  const [summaryTick, setSummaryTick] = useState(0);
  /** H19.6b: the New design has no email choice (emails are never shown on ads), so it is always phone. */
  const [contactMode, setContactMode] = useState(newDesign ? "phone" : "both");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState(false);
  const [whatsappSame, setWhatsappSame] = useState(true);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [telegramOn, setTelegramOn] = useState(false);
  const [telegram, setTelegram] = useState("");
  const [terms, setTerms] = useState(false);
  const [adult, setAdult] = useState(Boolean(adultAccepted));
  const [attrs, setAttrs] = useState<PostAttrs>({});
  const [draftId, setDraftId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [plans, setPlans] = useState<{ id: string; code?: string; name: string; amount?: number; description?: string }[]>([]);
  const [hydrated, setHydrated] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showAll, setShowAll] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoCount, setPhotoCount] = useState<number | null>(null);
  const [boost, setBoost] = useState<BoostChoiceValue>({ plan: null, balance: null });
  const [earn, setEarn] = useState<EarnInfo | null>(null);
  /** H21.5a: the per-ad video call switch. It is written as the listing field `videoCallsOff` with the details-stage PATCH (H21.5b, #512) and read back from the listing. */
  const [videoCallsOff, setVideoCallsOff] = useState(false);
  /** Edit on the Review step jumps to a step and comes back to Review when it is done. */
  const returnToReview = useRef(false);
  /** Set when Publish stopped for ad credits: the publish carries on once credits are added. */
  const resumeAfterRecharge = useRef(false);
  /** H21.6: the Buy-credits dialog (credits missing for the chosen option) and the wish to publish once it has been paid. */
  const [buy, setBuy] = useState<{ need: number; price: number; plan: string; balance: number; publishText: string } | null>(null);
  const publishAfterBuy = useRef<number | null>(null);
  const [publishedStatus, setPublishedStatus] = useState("");
  const [serverShort, setServerShort] = useState<{ need: number; balance: number } | null>(null);
  const [adSlug, setAdSlug] = useState("");
  const [adAddress, setAdAddress] = useState("");
  const [receipt, setReceipt] = useState("");
  const [boostDone, setBoostDone] = useState<SuccessFacts["boost"]>(null);
  const [chosenName, setChosenName] = useState("");
  const [planNote, setPlanNote] = useState("");
  const [draftStatus, setDraftStatus] = useState("");
  const money = usePostingMoney();
  const alreadyPaid = draftStatus !== "" && draftStatus !== "draft";
  /** H7.118: the ad is already posted, so this is an edit: same ad, no fee, "Save changes". */
  const editing = alreadyPaid;
  const chargesFee = money.paid;
  const short = alreadyPaid ? 0 : serverShort ? shortfallOf(serverShort.need, serverShort.balance) : shortfallOf(money.fee, money.balance);
  const draftRef = useRef("");
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  const category = categories.find((item) => item._id === categoryId);
  const previewCitySlug = cities.find((item) => item.id === cityId)?.slug ?? "";
  const categoryPreview = useCategoryPreview(category?.slug ?? "", previewCitySlug);
  const people = Boolean(category?.people) || category?.kind === "people";

  /** A people listing never starts with the account name: it is the name people see, so the person types it. */
  function pickedPeople(id: string) {
    const picked = categories.find((item) => item._id === id);
    if ((picked?.people || picked?.kind === "people") && defaultName && nickname === defaultName.slice(0, 20)) setNickname("");
  }
  const subOptions = subsByCategory[categoryId] ?? [];
  const fields = useMemo(() => wizardFields(category?.fields), [category]);
  // A people category always asks for the age (18 or over), even when its form has no age field (H10.1).
  const ageField = fields.find((field) => field.key === "age" || field.type === "number" && /age/i.test(field.label)) ?? (people ? BUILT_IN_AGE_FIELD : undefined);
  const extra = fields.filter((field) => field.key !== "age" && !/age/i.test(field.label));
  // H21.2: there is no separate "More details" step any more; the category's other fields sit in step 2.
  const split = false && newDesign && needsMoreStep(extra);
  const moreKeys = useMemo(() => (split ? extra.map((field) => field.key) : []), [split, extra]);
  const flow = useMemo(() => stepsFor(split), [split]);
  const current: NewPostStep = newDesign ? (flow[step - 1] ?? "category") : "category";
  const no = (name: NewPostStep) => flow.indexOf(name) + 1;
  const { steps } = copy;
  const stepTitles = [steps.basics.title, steps.photos.title, steps.review.title];
  const visiblePlans = copy.promotion.products.length
    ? plans.filter((plan) => copy.promotion.products.some((code) => code === plan.id || code === plan.code))
    : plans;
  const cityName = cities.find((item) => item.id === cityId)?.name ?? "";
  const stateSlug = pickedState || (cities.find((item) => item.id === cityId)?.stateSlug ?? "");
  const cityChoices = useMemo(() => placeChoices(cities, (city) => city.id), [cities]);
  const districtName = districts.find((item) => item.id === districtId)?.name ?? "";

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const raw = sp.get("step") || "1";
    const draft = sp.get("draft") || "";
    const id = window.setTimeout(() => {
      if (newDesign) pendingStep.current = raw;
      else {
        const next = raw === "photos" ? OLD_PHOTO_STEP : Number(raw);
        if (next >= 1 && next <= 3) setStep(next);
      }
      if (!draft) setStartReady(true);
      if (draft) {
        setDraftId(draft);
        setHydrated(false);
        api<SavedDraft>(`/api/listings/by-id/${draft}`).then((res) => {
          if (res.ok && res.data) {
            const form = draftToForm(res.data);
            setDraftStatus(String(res.data.status ?? ""));
            setCategoryId(form.categoryId);
            setSubcategoryId(form.subcategoryId);
            setCityId(form.cityId);
            setDistrictId(form.districtId);
            setAddress(form.address);
            setPostal(form.postal);
            setArea(form.area);
            setAge(form.age);
            setNickname((prev) => form.nickname || prev);
            // H21.5a: read the switch from the listing (the field exists once H21.5b is merged; until then it is simply absent, so On).
            setVideoCallsOff(Boolean((res.data as { videoCallsOff?: boolean | null }).videoCallsOff));
            setTitle(form.title);
            setText(form.text.trim());
            setPhone(form.phone);
            setWhatsapp(form.whatsapp);
            setWhatsappNumber(form.whatsappNumber);
            setWhatsappSame(!form.whatsappNumber || form.whatsappNumber === form.phone);
            setContactMode(newDesign ? "phone" : form.contactMode);
            setTelegram(form.telegram);
            setTelegramOn(Boolean(form.telegram));
            setAttrs(form.attrs);
            setTerms(true);
            setAdult(true);
          } else setBanner(t("post.error.draftLoad"));
          setHydrated(true);
          setStartReady(true);
        }).catch(() => {
          setBanner(t("post.error.draftLoad"));
          setHydrated(true);
          setStartReady(true);
        });
      }
    }, 0);
    if (!initialCategories?.length) {
      api<{ categories: Cat[] }>("/api/categories").then((res) => {
        if (res.ok) setCategories(res.data.categories || []);
      });
    }
    loadPostSubcategories().then(setSubsByCategory).catch(() => setSubsByCategory({}));
    if (!initialCities?.length) {
      api<{ locations: Place[] }>("/api/locations?type=city").then((res) => {
        if (res.ok) setCities([...(res.data.locations || [])].sort((a, b) => a.name.localeCompare(b.name)));
      });
    }
    if (document.cookie.split(";").some((part) => part.trim().startsWith("tk-in="))) {
      api<{ products: { id: string; code?: string; name: string; amount?: number; description?: string }[] }>("/api/promotions/products").then((res) => {
        if (res.ok) setPlans(res.data.products || []);
      });
    }
    return () => window.clearTimeout(id);
  }, [newDesign, initialCategories, initialCities, t]);

  useEffect(() => {
    if (!startReady || !pendingStep.current) return;
    if (categoryId && !category) return;
    const name = stepFromUrl(pendingStep.current);
    pendingStep.current = null;
    if (name && flow.indexOf(name) >= 0) setStep(flow.indexOf(name) + 1);
  }, [startReady, categoryId, category, flow]);

  useEffect(() => {
    if (!cityId) {
      const id = window.setTimeout(() => setDistricts([]), 0);
      return () => window.clearTimeout(id);
    }
    api<{ locations: Place[] }>(`/api/locations/${cityId}/children`).then((res) => {
      if (res.ok) setDistricts(res.data.locations || []);
    });
  }, [cityId]);

  function validate() {
    const next = validatePost({
      categoryId,
      subcategoryId,
      needsSubcategory: subOptions.length > 0,
      cityId,
      nickname,
      title,
      text,
      phone,
      contactMode,
      age,
      ageRequired: Boolean(ageField?.required),
      terms,
      adult,
      attrs,
      fields: extra.map((field) => ({ key: field.key, label: field.label, required: field.required, pick: field.options.length && (field.type === "select" || field.type === "multiselect") ? (field.type === "multiselect" ? "many" as const : "one" as const) : undefined })),
    });
    if (phone && contactMode !== "email" && !/^\+91[6-9]\d{9}$/.test(normalPhone(phone))) next.phone = t("post.error.phone");
    if (newDesign) Object.assign(next, validateContact({ mode: contactMode, whatsappOn: whatsapp, whatsappSame, whatsappNumber, telegramOn, telegram }));
    return next;
  }

  useEffect(() => {
    if (done) window.scrollTo(0, 0);
  }, [done]);

  // H21.12b: every step change opens at the top, with the focus on the step's heading (not on a button or a box further down).
  const openedStep = useRef(current);
  useEffect(() => {
    if (!newDesign || openedStep.current === current) return;
    openedStep.current = current;
    const open = () => {
      window.scrollTo(0, 0);
      const heading = document.querySelector<HTMLElement>("[data-tk=step-title]");
      if (!heading) return;
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    };
    open();
    // A second pass after the new step has drawn: its own effects must not leave the page scrolled down. It leaves the
    // focus alone when something has since taken it on purpose: the "Fix N things" box, a field or a link.
    const id = window.setTimeout(() => {
      if (document.activeElement?.matches("[data-tk=error-summary],input,select,textarea,a")) return;
      open();
    }, 120);
    return () => window.clearTimeout(id);
  }, [current, newDesign]);

  useEffect(() => {
    const id = window.setTimeout(() => setServerShort(null), 0);
    return () => window.clearTimeout(id);
  }, [money.balance]);

  const handleMedia = useCallback((media: DraftMedia) => {
    const cover = media.photos.find((photo) => photo.id === media.coverId) ?? media.photos[0];
    setCoverUrl(cover?.url ?? null);
    setPhotoCount(media.photos.length);
  }, []);

  useEffect(() => {
    if (!newDesign || !draftId || current === "photos") return;
    let live = true;
    void listDraftMediaAction(draftId).then((media) => {
      if (live && media) handleMedia(media);
    });
    return () => {
      live = false;
    };
  }, [newDesign, draftId, current, handleMedia]);

  /** H21.4: "We remember these". The first time step 4 opens with nothing filled in, it is filled from the account's last ad. Anything already typed stays. */
  const prefilledFromLast = useRef(false);
  useEffect(() => {
    if (!newDesign || current !== "contact" || !hydrated || prefilledFromLast.current) return;
    prefilledFromLast.current = true;
    if (phone || telegram || whatsappNumber) return;
    let live = true;
    void (async () => {
      const list = await api<{ items?: { id: string; createdAt?: string }[] }>("/api/listings/?pageSize=20");
      if (!live || !list.ok) return;
      const last = (list.data.items ?? [])
        .filter((item) => item.id !== draftId)
        .sort((x, y) => String(y.createdAt ?? "").localeCompare(String(x.createdAt ?? "")))[0];
      if (!last) return;
      const res = await api<SavedDraft>(`/api/listings/by-id/${last.id}`);
      if (!live || !res.ok || !res.data) return;
      const form = draftToForm(res.data);
      setPhone((now) => now || form.phone);
      setWhatsapp((now) => now || form.whatsapp);
      setWhatsappNumber((now) => now || form.whatsappNumber);
      if (form.whatsappNumber && form.whatsappNumber !== form.phone) setWhatsappSame(false);
      setTelegram((now) => now || form.telegram);
      setTelegramOn((now) => now || Boolean(form.telegram));
      setNickname((now) => now || form.nickname.slice(0, 20));
    })();
    return () => {
      live = false;
    };
    // The step opens once per page; the values it reads are only checked at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newDesign, current, hydrated]);

  function remember(id: string, nextStep: number) {
    if (flow[nextStep - 1] === "review") returnToReview.current = false;
    setTouched({});
    setShowAll(false);
    const url = `${postAdPath(paths)}?step=${newDesign ? urlStepOf(flow[nextStep - 1] ?? "category") : nextStep}&draft=${id}`;
    window.history.replaceState(null, "", url);
    setStep(nextStep);
  }

  function showErrors(found: Record<string, string>) {
    setErrors(found);
    setBanner("");
    setShowAll(Object.keys(found).length > 0);
    if (Object.keys(found).length) setSummaryTick((tick) => tick + 1);
    // On the details step the "Fix N things" box takes focus; on the other steps the first message is scrolled into view.
    if (Object.keys(found).length && current !== "details") document.querySelector("[data-tk=field-error]")?.scrollIntoView({ block: "center" });
    return Object.keys(found).length === 0;
  }

  /**
   * Saves the basics and the details of the draft, creating it on the first save. Returns the draft id, or "" when
   * the save failed (the banner then says why). The contact is sent only when `includeContact` is set, so a save from
   * an earlier step never clears a phone number that was saved later.
   */
  const whatsappValue = !whatsapp || (newDesign && contactMode === "email") ? "" : normalPhone(newDesign && !whatsappSame ? whatsappNumber : phone);

  function saveAll(includeContact: boolean, quiet = false): Promise<string> {
    const task = queueRef.current.then(() => doSave(includeContact, quiet));
    queueRef.current = task.catch(() => "");
    return task;
  }

  async function doSave(includeContact: boolean, quiet: boolean): Promise<string> {
    if (!quiet) setBusy(true);
    else setSaveState("saving");
    const emailOnly = newDesign && contactMode === "email";
    const basics = {
      categoryId,
      title: title.trim(),
      description: text.trim(),
      ...(subcategoryId ? { subcategoryId } : {}),
      ...(cityId ? { cityId } : {}),
      ...(districtId ? { districtId } : {}),
    };
    const existing = draftRef.current || draftId;
    const created = existing
      ? await api(`/api/listings/${existing}`, { method: "PATCH", body: JSON.stringify({ stage: "basics", ...basics }) })
      : await api<{ id: string }>("/api/listings", { method: "POST", body: JSON.stringify(basics) });
    if (created.ok && !existing) trackEvent("post_ad_start");
    if (!created.ok) {
      if (quiet) {
        setSaveState("idle");
        return "";
      }
      setBusy(false);
      setBanner(created.error.code === "UNAUTHORIZED" ? t("post.error.signIn") : friendlyError(created.error));
      return "";
    }
    const id = existing || String((created.data as { id?: string })?.id || "");
    draftRef.current = id;
    setDraftId(id);
    const contact = {
      ...(phone && !emailOnly ? { phone: normalPhone(phone) } : {}),
      ...(whatsappValue ? { whatsapp: whatsappValue } : {}),
      ...(telegramOn && telegram ? { telegram: newDesign ? `@${telegramHandle(telegram)}` : telegram } : {}),
      ...(newDesign && contactMode !== "phone" ? { acceptForm: true } : {}),
    };
    const details = await api(`/api/listings/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        stage: "details",
        attributes: { ...cleanAttrs(attrs), ...(age ? { age: Number(age) } : {}) },
        nickname,
        ...(newDesign ? { videoCallsOff } : {}),
        ...(includeContact ? { contact } : {}),
      }),
    });
    if (!quiet) setBusy(false);
    if (!details.ok) {
      if (quiet) {
        setSaveState("idle");
        return "";
      }
      const mapped = fieldErrors(details.error);
      const nextErrors: Record<string, string> = {};
      for (const [key, messages] of Object.entries(mapped)) {
        const message = Array.isArray(messages) ? messages[0] : String(messages || "");
        if (message) nextErrors[key] = message;
      }
      if (Object.keys(nextErrors).length) setErrors(nextErrors);
      setBanner(Object.values(nextErrors)[0] || friendlyError(details.error));
      return "";
    }
    setSaveState("saved");
    return id;
  }

  const saveLatest = useRef<() => void>(() => undefined);
  useEffect(() => {
    saveLatest.current = () => {
      const valid = Boolean(categoryId) && (subOptions.length === 0 || Boolean(subcategoryId)) && title.trim().length >= 5 && Boolean(cityId);
      if (!newDesign || !hydrated || !["category", "details", "more"].includes(current) || !valid || done) return;
      void saveAll(false, true).then((id) => {
        if (id) window.history.replaceState(null, "", `${postAdPath(paths)}?step=${urlStepOf(current)}&draft=${id}`);
      });
    };
  });

  useEffect(() => {
    if (!newDesign) return;
    const id = window.setTimeout(() => saveLatest.current(), 800);
    return () => window.clearTimeout(id);
  }, [newDesign, categoryId, subcategoryId, cityId, districtId, title, text, nickname, age, attrs]);

  function moveOnEnter(event: React.KeyboardEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    if (event.key !== "Enter" || !(target instanceof HTMLInputElement) || target.type === "checkbox") return;
    event.preventDefault();
    const fields = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("input:not([type=hidden]):not([type=checkbox]), select, textarea")).filter((el) => !el.hasAttribute("disabled"));
    const next = fields[fields.indexOf(target) + 1];
    if (next) next.focus();
    else document.querySelector<HTMLButtonElement>("[data-tk=go-on]")?.click();
  }

  function keepFocusedFieldVisible(event: React.FocusEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    if (!/^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName) || !window.matchMedia("(max-width: 1023px)").matches) return;
    window.setTimeout(() => target.scrollIntoView({ block: "center", behavior: "smooth" }), 250);
  }

  /** The three-step form (New design off): one check of everything, then one save. */
  async function goOn() {
    if (!showErrors(validate())) return;
    const id = await saveAll(true);
    if (id) remember(id, OLD_PHOTO_STEP);
  }

  /** The five-step form (New design on): each step checks only its own fields and saves what it owns. */
  async function saveAbout(): Promise<boolean> {
    if (!about) return true;
    setBusy(true);
    const res = await api("/api/auth/seller-profile", {
      method: "PUT",
      body: JSON.stringify({
        name: nickname.trim(),
        city: cityName,
        whatsapp: whatsappValue,
        availableNow: false,
      }),
    });
    setBusy(false);
    if (res.ok) return true;
    const keyOf: Record<string, string> = { name: "nickname", city: "city", whatsapp: "phone" };
    const found: Record<string, string> = {};
    for (const [key, messages] of Object.entries(fieldErrors(res.error))) {
      const message = Array.isArray(messages) ? messages[0] : String(messages || "");
      if (message) found[keyOf[key] ?? key] = message;
    }
    if (Object.keys(found).length) showErrors(found);
    else setBanner(res.error.code === "UNAUTHORIZED" ? t("post.error.signIn") : friendlyError(res.error));
    return false;
  }

  async function continueFrom(from: NewPostStep) {
    if (!showErrors(errorsForStep(validate(), from, Boolean(about), moreKeys))) return;
    if (from === "category") return setStep(no("details"));
    if (from === "photos") return remember(draftId, returnToReview.current ? no("review") : no("contact"));
    // H19.6b: the wizard never asks for a date of birth. An account that has none (a code sign-in) adds it once in its seller profile, then comes back.
    if (from === "contact" && about?.askDateOfBirth) return setBanner(t("post.about.dobAway"));
    if (from === "contact" && !(await saveAbout())) return;
    const id = await saveAll(from === "contact");
    if (id) {
      const back = returnToReview.current;
      remember(id, back ? no("review") : step + 1);
    }
  }

  async function publish() {
    if (!hydrated) return setBanner(t("post.error.draftLoading"));
    if (!draftId || !title.trim()) return setBanner(t("post.error.saveFirst"));
    if (newDesign && !showErrors(errorsForStep(validate(), "review"))) return;
    // H21.12a: with a boost the one "need" figure is the total minus the balance, checked just below.
    if (newDesign && short > 0 && (alreadyPaid || !boost.plan)) return openRecharge({ shortfall: short, wallet: "ad" });
    // H19.6b: TOP or Super Top is bought with ad credits together with the posting fee. Short: the ad-credit recharge sheet opens and the publish carries on after it.
    const plan = alreadyPaid ? null : boost.plan;
    if (newDesign && plan) {
      const wallet = await api<{ balance: number }>("/api/wallet/");
      const have = wallet.ok ? Number(wallet.data.balance) || 0 : boost.balance;
      const lacking = adCreditsShort(adCreditsNeeded({ fee: chargesFee ? money.fee : 0, plan }), have);
      if (lacking > 0) {
        resumeAfterRecharge.current = true;
        return openRecharge({ shortfall: lacking, wallet: "ad" });
      }
    }
    setBusy(true);
    setBanner("");
    // H6.14: the ID check is asked for only when the switch is on. Off, the submit goes straight to the server.
    if (requireIdCheck) {
      const me = await api<{ verification?: { status?: string }; user?: { verificationStatus?: string } }>("/api/auth/me");
      const verification = me.ok ? me.data.verification?.status || me.data.user?.verificationStatus : "";
      if (needsIdCheck(verification)) {
        setBusy(false);
        setBanner(PUBLISH_MESSAGES.VERIFICATION_REQUIRED);
        return;
      }
    }
    const res = await api(`/api/listings/${draftId}/submit`, {
      method: "POST",
      body: JSON.stringify({ attestations: { adult: true, accurate: true, rights: true } }),
    });
    setBusy(false);
    if (!res.ok) {
      const lack = insufficientFrom(res.error, money.fee);
      if (lack) {
        setServerShort(lack);
        void money.refresh();
        return;
      }
      if (res.error.code === "VERIFICATION_REQUIRED") {
        setBanner(PUBLISH_MESSAGES.VERIFICATION_REQUIRED);
        return;
      }
      setBanner(friendlyError(res.error));
      return;
    }
    const outcome = (res.data ?? {}) as { status?: string; charged?: number; balance?: number };
    setPublishedStatus(String(outcome.status ?? "active"));
    trackEvent("post_ad_published");
    window.dispatchEvent(new CustomEvent(CREDITS_ADDED_EVENT, { detail: { added: 0 } }));
    if (newDesign) {
      const charged = typeof outcome.charged === "number" ? outcome.charged : alreadyPaid ? 0 : money.fee;
      let left = typeof outcome.balance === "number" ? outcome.balance : Math.max(0, (money.balance ?? 0) - charged);
      // The boost starts at once when the ad is live; an ad waiting for a check is boosted from My ads once it is live.
      let boostNote = "";
      if (plan) {
        setChosenName(plan.name);
        if (String(outcome.status ?? "active") === "active") {
          const bought = await api<{ balance?: number; endsAt?: string | null }>("/api/promotions", { method: "POST", body: JSON.stringify({ listingId: draftId, productId: plan.id, idempotencyKey: idempotencyKey(`post-${draftId}-${plan.id}`) }) });
          if (bought.ok) {
            setBoostDone({ name: plan.name, endsAt: bought.data?.endsAt ?? null, credits: plan.amount });
            if (typeof bought.data?.balance === "number") left = bought.data.balance;
          } else boostNote = t("post.boost.failed", { reason: friendlyError(bought.error) });
        }
      }
      const base = !chargesFee ? "" : charged > 0 ? t("post.receipt.paid", { paid: creditsText(charged), balance: creditsText(left) }) : t("post.receipt.free", { balance: creditsText(left) });
      setReceipt([base, boostNote].filter(Boolean).join(" "));
      void api<{ slug?: string; address?: string | null }>(`/api/listings/by-id/${draftId}`).then((found) => {
        if (found.ok && found.data?.slug) setAdSlug(found.data.slug);
        if (found.ok && found.data?.address) setAdAddress(found.data.address);
      });
    }
    window.history.replaceState(null, "", postAdPath(paths));
    setDone(true);
  }

  const publishLatest = useRef<() => void>(() => undefined);
  useEffect(() => {
    publishLatest.current = () => void publish();
  });
  useEffect(() => {
    // After "Publish with ..." in the Buy-credits dialog: publish once the balances on this page show the new balance.
    if (buy || publishAfterBuy.current === null) return;
    if (short > 0 || (boost.balance !== null && boost.balance !== publishAfterBuy.current)) return;
    publishAfterBuy.current = null;
    publishLatest.current();
  }, [buy, short, boost.balance]);
  useEffect(() => {
    function onAdded(event: Event) {
      const added = Number((event as CustomEvent<{ added?: number }>).detail?.added ?? 0);
      if (added <= 0 || !resumeAfterRecharge.current) return;
      resumeAfterRecharge.current = false;
      publishLatest.current();
    }
    window.addEventListener(CREDITS_ADDED_EVENT, onAdded);
    return () => window.removeEventListener(CREDITS_ADDED_EVENT, onAdded);
  }, []);

  useEffect(() => {
    if (!newDesign || current !== "review" || editing) return;
    let live = true;
    void api<EarnInfo>("/api/tours/earn-info").then((res) => {
      if (live && res.ok) setEarn(res.data);
    });
    return () => {
      live = false;
    };
  }, [newDesign, current, editing]);

  function buyPlan(plan: UpsellPlan) {
    setPlanNote("");
    openPromote({ listingId: draftId, title: title.trim(), planId: plan.id });
  }

  const preview = useMemo(
    () => ({ slug: "preview", title, description: text, variant: "free", publicId: "preview" }),
    [title, text],
  );

  const shownDistrict = districtName.toLowerCase() === `${cityName} city`.toLowerCase() ? "" : districtName;
  const adPreview = previewAd({
    title: title.trim(),
    description: text.trim(),
    categorySlug: category?.slug ?? "",
    citySlug: cities.find((item) => item.id === cityId)?.slug ?? "",
    districtName: shownDistrict,
    cover: coverUrl,
    cityFallback: !cityId,
  }, t);
  const byline = people ? [nickname.trim(), age.trim()].filter(Boolean).join(", ") : "";

  if (done && newDesign) {
    const isLive = publishedStatus === "active" || (editing && publishedStatus === "paused");
    return (
      <PostShell percent={progressPercent(flow.length, flow.length, true)} variant="done">
      <PostSuccess
        copy={newSuccessCopy(copy, isLive || editing, editing, t)}
        live={isLive}
        where={[cityName, category?.name].filter(Boolean).join(" ")}
        ad={adPreview}
        hasPhoto={Boolean(coverUrl)}
        byline={byline}
        anotherHref={copy.success.secondaryCta?.href || postAdPath(paths)}
        adHref={adAddress || (adSlug ? `/ad/${adSlug}/` : "")}
        receipt={receipt}
        plans={visiblePlans.filter((plan) => (plan.amount ?? 0) > 0)}
        facts={{ city: cityName, category: category?.name ?? "", place: [shownDistrict, cityName].filter(Boolean).join(", "), tags: [category?.name ?? "", ...picksOf(attrs[INTEREST_KEY])].filter(Boolean), boost: boostDone, chosenName }}
        planNote={planNote}
        onPlan={buyPlan}
        saved={editing}
        paused={publishedStatus === "paused"}
      />
      </PostShell>
    );
  }

  if (done) {
    return (
      <div className={newDesign ? "tkp-post" : "tk-container"} style={newDesign ? undefined : { padding: "24px 0 40px" }}>
        <h1 className="tk-page-h1" data-tk="step-title">{copy.success.title}</h1>
        {copy.success.text ? <p style={{ textAlign: "center" }}>{copy.success.text}</p> : null}
        <p style={{ textAlign: "center" }}>
          {copy.success.primaryCta ? <SuccessLink cta={copy.success.primaryCta} fallback={postAdPath(paths)} /> : null}
          {copy.success.primaryCta && copy.success.secondaryCta ? " · " : null}
          {copy.success.secondaryCta ? <SuccessLink cta={copy.success.secondaryCta} fallback={postAdPath(paths)} /> : null}
        </p>
      </div>
    );
  }

  if (newDesign) return renderNewDesign();

  return (
    <div className="tk-container" style={{ padding: "16px 0 40px" }}>
      {copy.intro ? (
        <section data-tk="post-intro" style={{ marginBottom: 12 }}>
          {copy.intro.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={copy.intro.image.src} alt={copy.intro.image.alt} width={copy.intro.image.width} height={copy.intro.image.height} style={{ maxWidth: "100%", height: "auto" }} />
          ) : null}
          <h2 className="t-h3">{copy.intro.title}</h2>
          {copy.intro.text ? <p className="t-small">{copy.intro.text}</p> : null}
        </section>
      ) : null}
      <div className="tk-progress" data-tk="progress" aria-hidden>
        <i className={step >= 1 ? "on" : ""} />
        <i className={step >= 2 ? "on" : ""} />
        <i className={step >= 3 ? "on" : ""} />
      </div>
      <p className="tk-step-of" data-tk="step-of">{t("post.step.of3", { step, title: stepTitles[step - 1] })}</p>
      <div className="tk-step-head">
        <h1 className="tk-page-h1" data-tk="step-title" style={{ margin: 0 }}>
          {stepTitles[step - 1]}
        </h1>
      </div>
      {step === 1 && steps.basics.help ? <p className="t-small" data-tk="step-help">{steps.basics.help}</p> : null}
      <div aria-live="polite" className="t-small" style={{ color: "var(--danger)", margin: "12px 0" }}>
        {banner}{" "}
        {(banner === t("post.error.signIn") || banner.startsWith("Sign in")) ? <Link href={`${loginPath(paths)}?next=${encodeURIComponent(postAdPath(paths))}`}>{t("post.banner.logIn")}</Link> : null}
        {banner === PUBLISH_MESSAGES.VERIFICATION_REQUIRED ? <Link href="/u/account/kyc/" data-tk="verify-id">{t("post.banner.verifyId")}</Link> : null}
      </div>
      {step === 1 ? (
        <>
          <Group title={t("post.group.yourAd")}>
            <SelectField id="category" label={t("post.select.category")} required value={categoryId} error={errors.category} onChange={(value) => { setCategoryId(value); setSubcategoryId(""); }}>
              <option value="">{t("post.select.category")}</option>
              {categories.map((cat) => (
                <option key={cat._id} value={cat._id}>{cat.name}</option>
              ))}
            </SelectField>
            {subOptions.length > 0 ? (
              <SelectField id="subcategory" label={t("post.select.subcategory")} required value={subcategoryId} error={errors.subcategory} onChange={setSubcategoryId}>
                <option value="">{t("post.select.subcategory")}</option>
                {subOptions.map((sub) => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </SelectField>
            ) : null}
            <SelectField id="city" label={t("post.select.city")} required value={cityId} error={errors.city} searchOptions={cityChoices} searchPlaceholder={t("post.select.cityType")} searchEmpty={t("post.select.cityNone")} onChange={(value) => { setCityId(value); setDistrictId(""); }}>
              <option value="">{t("post.select.city")}</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>{city.name}</option>
              ))}
            </SelectField>
            <SelectField id="district" label={t("post.select.district")} value={districtId} error={errors.district} disabled={!cityId} onChange={setDistrictId}>
              <option value="">{t("post.select.district")}</option>
              {districts.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </SelectField>
            <div className="tk-modal-grid">
              <TextField id="address" label={t("post.field.address")} value={address} onChange={setAddress} />
              <TextField id="postal" label={t("post.field.postalCode")} value={postal} onChange={setPostal} />
            </div>
            <TextField id="area" label={t("post.field.area")} value={area} onChange={setArea} />
          </Group>
          <Group title={steps.details.title} help={steps.details.help}>
            {ageField ? <TextField id="age" label={t("post.field.age")} required value={age} error={errors.age} onChange={setAge} /> : null}
            <TextField id="nickname" label={t("post.field.nickname")} required value={nickname} error={errors.nickname} note={t("post.field.nicknameNote")} placeholder={t("post.field.nicknamePlaceholder")} onChange={setNickname} />
            <TextField id="title" label={t("post.field.title")} required area value={title} error={errors.title} note={t("post.field.titleNote")} placeholder={t("post.field.titlePlaceholder")} onChange={setTitle} />
            <TextField id="text" label={t("post.field.text")} area rows={5} value={text} error={errors.text} note={t("post.field.textNote")} placeholder={t("post.field.textPlaceholder")} onChange={setText} />
          </Group>
          {renderExtraFields()}
          {renderContactFields()}
          {renderConsents()}
          <p style={{ textAlign: "right", marginTop: 24 }}>
            <button type="button" className="tk-btn tk-btn-cta" data-tk="go-on" disabled={busy} onClick={goOn}>{steps.basics.nextLabel}</button>
          </p>
        </>
      ) : null}
      {step === 2 ? (
        <PhotoStep listingId={draftId} copy={copy} allowVideo={!people} onBack={() => remember(draftId, 1)} onNext={() => remember(draftId, 3)} />
      ) : null}
      {step === 3 ? (
        <>
          <div className="tk-form-panel">
            <h2 className="t-h3">{t("post.preview.title")}</h2>
            {hydrated && title.trim() ? <AdCard ad={preview as ListingDoc} /> : <p data-tk="draft-loading">{hydrated ? t("post.preview.noTitle") : t("post.preview.loading")}</p>}
          </div>
          {copy.promoteHidden ? null : (
            <div className="tk-form-panel" style={{ marginTop: 16 }} data-tk="promote-step">
              <h2 className="t-h3">{steps.promote.title}</h2>
              {copy.promotion.title ? <p className="t-small" style={{ fontWeight: 600 }}>{copy.promotion.title}</p> : null}
              {steps.promote.help ? <p className="t-small">{steps.promote.help}</p> : null}
              {visiblePlans.length ? visiblePlans.map((plan) => (
                <p key={plan.id} className="t-small">{plan.name}{plan.amount !== undefined ? ` · ₹${plan.amount}` : ""}</p>
              )) : (
                <p className="t-small">{copy.promotion.note} <Link href="/u/account/credits/" style={{ color: "var(--accent)" }}>{t("post.promote.boost")}</Link></p>
              )}
            </div>
          )}
          <p style={{ textAlign: "right", marginTop: 16 }}>
            <button type="button" className="tk-btn tk-btn-outline-primary" onClick={() => setStep(2)}>{steps.review.backLabel}</button>{" "}
            <button type="button" className="tk-btn tk-btn-cta" data-tk="go-on" disabled={busy || !hydrated || !title.trim()} onClick={publish}>{steps.review.nextLabel}</button>
          </p>
        </>
      ) : null}
      <HelpCard />
    </div>
  );

  /** The category fields the seller fills in (the "About You" group in the old form, a plain block in the New design). */
  function renderExtraFields() {
    if (!extra.length) return null;
    const rows = (
      <>
        {extra.map((field) =>
          field.options.length && (field.type === "select" || field.type === "multiselect") ? (
            <PickGroup
              key={field.key}
              label={field.label}
              help={field.help}
              required={field.required}
              options={field.options}
              mode={field.type === "multiselect" ? "many" : "one"}
              max={field.maxPicks ?? DEFAULT_PICK_LIMIT}
              selected={picksOf(attrs[field.key])}
              error={errors[field.key]}
              onChange={(next) => setAttrs((prev) => ({ ...prev, [field.key]: field.type === "multiselect" ? next : (next[0] ?? "") }))}
            />
          ) : (
            <TextField key={field.key} id={field.key} label={field.label} required={field.required} note={field.help} placeholder={field.placeholder} error={errors[field.key]} value={textOf(attrs[field.key])} onChange={(value) => setAttrs((prev) => ({ ...prev, [field.key]: value }))} />
          ),
        )}
      </>
    );
    return <Group title={t("post.group.aboutYou")}>{rows}</Group>;
  }

  /** H21.1: the chips of the category's filters ("All" first), taken from its filterable choice fields. */
  function previewChips(): string[] {
    const field = (category?.fields ?? []).find((item) => item.filterable !== false && Array.isArray(item.options) && (item.options as unknown[]).length > 0);
    const words = field ? (field.options as unknown[]).map((option) => (typeof option === "string" ? option : String((option as { label?: string }).label ?? ""))).filter(Boolean) : [];
    // H21.12b: the board shows three words after "All"; where the filter has fewer, the category's own sub-categories fill in.
    return [...new Set([...words, ...subOptions.map((item) => item.name)])];
  }

  function renderCategoryPreview(where: "inline" | "side") {
    if (!category) return <CategoryPreviewHint where={where} />;
    return <CategoryPreview where={where} categoryName={category.name} cityName={cityName} chips={previewChips()} hits={categoryPreview.hits} loading={categoryPreview.loading} />;
  }

  /** The fee note and, on a phone, the preview, under the category tiles. */
  function renderCategoryExtras(where: "inline") {
    const note = editing || !money.ready ? "" : feeNote(t, money);
    return (
      <>
        {note ? (
          <p className="tkp-fee-note" data-tk="post-fee-note">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b0106a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" /></svg>
            <span>{note}</span>
          </p>
        ) : null}
        {renderCategoryPreview(where)}
      </>
    );
  }

  function renderNewExtras(err: (key: string) => string | undefined, blur: (key: string) => () => void) {
    const change = (key: string, value: string | string[]) => setAttrs((prev) => ({ ...prev, [key]: value }));
    const shownExtra = extra.filter((field) => field.key !== INTEREST_KEY);
    const cells = shownExtra.filter((field) => !isChipField(field));
    const chips = shownExtra.filter(isChipField);
    const rows: (typeof extra)[] = [];
    for (let index = 0; index < cells.length; index += 2) rows.push(cells.slice(index, index + 2));
    const cell = (field: (typeof extra)[number]) =>
      field.type === "select" && field.options.length > LONG_LIST ? (
        <SelectField key={field.key} id={field.key} label={field.label} required={field.required} value={textOf(attrs[field.key])} error={err(field.key)} onBlur={blur(field.key)} onChange={(value) => change(field.key, value)}>
          <option value="">{t("post.select.plain")}</option>
          {field.options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </SelectField>
      ) : (
        <TextField
          key={field.key}
          id={field.key}
          label={field.label}
          required={field.required}
          type={field.type === "date" ? "date" : "text"}
          inputMode={field.type === "number" ? "numeric" : undefined}
          placeholder={field.placeholder}
          error={err(field.key)}
          onBlur={blur(field.key)}
          value={textOf(attrs[field.key])}
          onChange={(value) => change(field.key, value)}
        />
      );
    return (
      <>
        {rows.map((pair) => (
          <div key={pair.map((field) => field.key).join("|")} className="tkp-two tkp-two-keep">
            {pair.map(cell)}
            {pair.length === 1 ? <span /> : null}
          </div>
        ))}
        {chips.map((field) => (
          <PickGroup
            key={field.key}
            label={field.label}
            help={field.help}
            required={field.required}
            options={field.options}
            mode={field.type === "multiselect" ? "many" : "one"}
            max={field.maxPicks ?? DEFAULT_PICK_LIMIT}
            selected={picksOf(attrs[field.key])}
            error={err(field.key)}
            onChange={(next) => change(field.key, field.type === "multiselect" ? next : (next[0] ?? ""))}
          />
        ))}
      </>
    );
  }

  function renderContactFields() {
    return (
      <Group title={steps.contact.title} help={steps.contact.help}>
        <p className="t-small">{t("post.contact.how")}</p>
        <div className="tk-radios">
          {[
            ["phone", t("post.contact.phoneOnly")],
            ["email", t("post.contact.emailOnly")],
            ["both", t("post.contact.both")],
          ].map(([id, label]) => (
            <button key={id} type="button" className={`tk-radio ${contactMode === id ? "on" : ""}`} onClick={() => setContactMode(id)}>
              {label}
            </button>
          ))}
        </div>
        <TextField id="phone" label={t("post.contact.phone")} required={contactMode !== "email"} value={phone} error={errors.phone} placeholder="+91 81234 56789" onChange={setPhone} />
        <div className="tk-switch-row"><span>{t("post.contact.whatsapp")}</span><Switch on={whatsapp} onClick={() => setWhatsapp((v) => !v)} label={t("post.contact.whatsapp")} /></div>
        <div className="tk-switch-row"><span>{t("post.contact.telegram")}</span><Switch on={telegramOn} onClick={() => setTelegramOn((v) => !v)} label={t("post.contact.telegram")} /></div>
        {telegramOn ? <TextField id="telegram" label={t("post.contact.telegram")} value={telegram} onChange={setTelegram} /> : null}
      </Group>
    );
  }

  function renderConsents() {
    return (
      <>
        <p className={`t-small tk-consent tk-consent-first ${errors.terms ? "is-bad" : ""}`}>
          <input id="consent-terms" type="checkbox" className="tk-check" checked={terms} onChange={() => setTerms((v) => !v)} aria-invalid={Boolean(errors.terms)} />
          <label htmlFor="consent-terms">
          <strong>{t("post.consent.heading")}</strong> {t("post.consent.read")} <Link href="/terms/">{t("post.consent.terms")}</Link> {t("post.consent.andPrivacy")} <Link href="/privacy/">{t("post.consent.privacy")}</Link> {t("post.consent.authorise")}
          </label>
          {errors.terms ? <span className="tk-error" data-tk="field-error">{errors.terms}</span> : null}
        </p>
        <p className={`t-small tk-consent ${errors.adult ? "is-bad" : ""}`}>
          <input id="consent-adult" type="checkbox" className="tk-check" checked={adult} onChange={() => setAdult((v) => !v)} aria-invalid={Boolean(errors.adult)} />
          <label htmlFor="consent-adult">{t("post.consent.adult")}</label>
          {errors.adult ? <span className="tk-error" data-tk="field-error">{errors.adult}</span> : null}
        </p>
      </>
    );
  }

  /** H7.83: the New design. Five steps, a step rail, the live preview (the real ad card) and the tip. Logic is shared with the three-step form. */
  function renderNewDesign() {
    const stepCopy = newStepCopy(current, copy, Boolean(about), people, money.fee, editing, contactMode, t);
    const railItems: RailItem[] = flow.map((key, index) => ({
      key,
      label: key === "more" ? t(RAIL_MORE_KEY) : t(RAIL_LABEL_KEYS[key]),
      num: index + 1,
      state: index + 1 < step ? "done" : index + 1 === step ? "current" : "todo",
      clickable: index + 1 < step ? true : index + 1 === step,
    }));
    const placeParts = [cityName, shownDistrict].filter(Boolean).join(" / ");
    // H21.3: the photo step has its own lead line (the stock wording is replaced in newStepCopy).
    const headHelp = stepCopy.help;
    const hints = hintsFor(category?.slug);
    const subName = subOptions.find((sub) => sub.id === subcategoryId)?.name;
    const contactSummary = contactMode === "email" ? t("post.review.emailOnly") : phone ? `${normalPhone(phone)}${contactMode === "both" ? t("post.review.andEmail") : ""}` : t("post.review.notSet");
    const answers = extra.flatMap((field) => {
      const value = attrs[field.key];
      return Array.isArray(value) ? value.map(String) : textOf(value) ? [textOf(value)] : [];
    });
    const detailsText = [...picksOf(attrs[INTEREST_KEY]), ...answers].filter(Boolean).join(" \u00b7 ");
    const photosText = photoCount === null ? (draftId ? t("post.review.checking") : t("post.v2.rev.noPhotos")) : photoCount === 0 ? t("post.v2.rev.noPhotos") : photoCount === 1 ? t("post.v2.rev.photo1") : t("post.v2.rev.photos", { count: photoCount });
    // The spaces inside the number do not break, so it never wraps in the middle.
    const reach = [phone ? formatPhone(normalPhone(phone)).replace(/ /g, "\u00a0") : "", [whatsapp ? t("post.contactBox.whatsapp") : "", telegramOn ? t("post.contactBox.telegram") : ""].filter(Boolean).join(", ")].filter(Boolean);
    const contactText = [nickname.trim(), ...reach].filter(Boolean).join(" \u00b7 ") || t("post.v2.rev.notSet");
    const reviewRows: ReviewRow[] = [
      { key: "category", label: t("post.v2.rev.rowCategory"), value: [category?.name, subName].filter(Boolean).join(" \u203a ") || t("post.review.notChosen"), step: 1 },
      { key: "details", label: t("post.v2.rev.rowDetails"), value: detailsText || t("post.v2.rev.notSet"), step: no("details") },
      { key: "photos", label: t("post.v2.rev.rowPhotos"), value: photosText, step: no("photos") },
      { key: "contact", label: t("post.v2.rev.rowContact"), value: contactText, step: no("contact") },
    ];
    const boostPlan = alreadyPaid ? null : boost.plan;
    const planNeed = adCreditsNeeded({ fee: chargesFee && !alreadyPaid ? money.fee : 0, plan: boostPlan });
    const publishText = publishLabel(t, planNeed, boostPlan?.name ?? "");
    const adBalance = serverShort ? serverShort.balance : (boost.balance ?? money.balance);
    // H21.12a: the only "you need N more" figure on the page: Total today minus the balance.
    const totalShort = adCreditsShort(planNeed, adBalance);
    const openBuy = (need: number) => setBuy({ need, price: planNeed, plan: boostPlan?.name ?? t("post.v2.money.thisAd"), balance: adBalance ?? 0, publishText });
    const low = totalShort > 0
      ? {
          title: t("post.v2.rev.lowTitle", { plan: boostPlan?.name ?? t("post.v2.money.thisAdIn") }),
          body: `${t("post.v2.rev.lowBody", { need: totalShort })}${boostPlan && adCreditsShort(planNeed - boostPlan.amount, adBalance) === 0 ? ` ${t("post.v2.money.lowOrNormal")}` : ""}`,
          onBuy: () => openBuy(totalShort),
        }
      : null;
    const listKind: ListKind = boostPlan ? (boostPlan.code === "super-top" ? "super" : "top") : "free";
    const earnState: "on" | "off" | "locked" = !boostPlan ? "locked" : videoCallsOff ? "off" : "on";
    const cost = costBox(t, { money: alreadyPaid ? { paidOn: false, fee: 0, quota: null } : money, plan: boostPlan });
    const listPlace = [shownDistrict, cityName].filter(Boolean).join(", ");
    const listHits = categoryPreview.hits;
    const listPreview = (where: "inline" | "side") => (
      <ReviewListPreview where={where} chips={previewChips()} kind={listKind} hours={boostPlan?.durationHours ?? null} categoryName={category?.name ?? ""} cityName={cityName} title={title.trim() || t("post.v2.det.previewTitle")} place={listPlace} cover={coverUrl} hits={listHits} />
    );
    const categoryReady = Boolean(categoryId) && (subOptions.length === 0 || Boolean(subcategoryId));
    const live = errorsForStep(validate(), current, Boolean(about), moreKeys);
    // Once Continue was pressed the live checks rule for every field they cover, so a message goes away as soon as the field is fixed.
    const checked = new Set(["title", "city", "nickname", "age", "phone", "terms", "adult", "category", "subcategory", ...extra.map((field) => field.key)]);
    const err = (key: string) => (showAll || touched[key] ? live[key] : undefined) ?? (showAll && checked.has(key) ? undefined : errors[key]);
    const blur = (key: string) => () => setTouched((prev) => ({ ...prev, [key]: true }));
    const titleError = err("title") ? (title.trim() ? t("post.v2.det.errTitleShort") : t("post.v2.det.errTitle")) : undefined;
    const cityError = err("city") ? t("post.v2.det.errCity") : undefined;
    const labelOf = (key: string) => {
      const name = key === "nickname" ? t("post.field.nickname") : key === "age" ? t("post.field.age") : (extra.find((field) => field.key === key)?.label ?? "");
      return name ? `${name}: ` : "";
    };
    const summaryItems: SummaryItem[] =
      current === "details" && showAll
        ? Object.entries(live).map(([key, message]) => ({
            id: key,
            text: key === "title" ? (title.trim() ? t("post.v2.det.errTitleShort") : t("post.v2.det.sumTitle")) : key === "city" ? t("post.v2.det.sumCity") : `${labelOf(key)}${message}`,
          }))
        : [];
    const detailsCard = (
      <DetailsPreview title={title} categoryName={category?.name ?? ""} placeName={[cityName, shownDistrict].filter(Boolean).join(" / ")} interests={picksOf(attrs[INTEREST_KEY])} accountName={accountName} name={nickname} cover={coverUrl} editing={current === "photos" ? "" : current === "contact" ? "name" : editingPart} highlightPhoto={current === "photos"} />
    );
    const popularInterests = popularInterestsOf(category?.fields ?? []);
    return (
      <PostShell percent={progressPercent(step, flow.length)} saveState={saveState}>
      <div className="tkp-post" data-design="post-new">
        <div className="tkp-strip" data-tk="step-strip">
          <span>{t("post.v2.strip", { step, total: flow.length, title: stepCopy.title })}</span>
          {current === "review" ? null : <button type="button" className="tkp-strip-btn" data-tk="open-preview" onClick={() => setPreviewOpen(true)}>{t("post.preview.title")}</button>}
        </div>
        <div className="tkp-grid">
          <PostRail
            items={railItems}
            progressLabel={t("post.v2.rail.title")}
            onGo={(num) => {
              if (num === step) return;
              if (draftId) remember(draftId, num);
              else setStep(num);
            }}
          >
            <button type="button" className="tkp-help-link" data-tk="post-help" aria-label={t("post.header.helpLabel")} onClick={() => openSupportWith("")}>{t("post.v2.rail.help")}</button>
          </PostRail>
          <section className="tkp-main" data-step={current} data-dir={stepMove.dir || undefined} aria-labelledby="post-step-title" onFocusCapture={keepFocusedFieldVisible}>
            <div className="tkp-head">
              <p className="tkp-kicker" data-tk="step-of">{t("post.step.of", { step, total: flow.length })}</p>
              <h1 id="post-step-title" className="tkp-h1" data-tk="step-title">{stepCopy.title}</h1>
              {headHelp ? <p className="tkp-help" data-tk="step-help">{headHelp}</p> : null}
              <div aria-live="polite" className="tkp-banner">
                {banner}{" "}
                {(banner === t("post.error.signIn") || banner.startsWith("Sign in")) ? <Link href={`${loginPath(paths)}?next=${encodeURIComponent(postAdPath(paths))}`}>{t("post.banner.logIn")}</Link> : null}
                {banner === PUBLISH_MESSAGES.VERIFICATION_REQUIRED ? <Link href="/u/account/kyc/" data-tk="verify-id">{t("post.banner.verifyId")}</Link> : null}
              </div>
            </div>
            <div className="tkp-scroll" key={current} onKeyDown={moveOnEnter}>
              {current === "category" ? (
                <>
                  <CategoryTiles categories={categories} selectedId={categoryId} locked={editing} onPick={(id) => { setCategoryId(id); setSubcategoryId(""); pickedPeople(id); }} />
                  {errors.category ? <p className="tk-error" data-tk="field-error">{errors.category}</p> : null}
                  {renderCategoryExtras("inline")}
                  {subOptions.length > 0 ? (
                    <>
                      <p className="tkp-sub-title" id="sub-title">{category ? t("post.sub.titleIn", { category: category.name }) : t("post.field.subcategory")}</p>
                      <div className="tkp-chips" role="group" aria-labelledby="sub-title">
                        {subOptions.map((sub) => {
                          const pressed = sub.id === subcategoryId;
                          return (
                            <button key={sub.id} type="button" className={`tkp-chip ${pressed ? "on" : ""}`} aria-pressed={pressed} onClick={() => setSubcategoryId(sub.id)}>
                              {sub.name}
                            </button>
                          );
                        })}
                      </div>
                      {errors.subcategory ? <p className="tk-error" data-tk="field-error">{errors.subcategory}</p> : null}
                    </>
                  ) : null}
                </>
              ) : null}

              {current === "details" ? (
                <DetailsStep
                  categoryName={category?.name ?? ""}
                  onChangeCategory={editing ? undefined : () => (draftId ? remember(draftId, 1) : setStep(1))}
                  title={title}
                  titlePlaceholder={hints.title}
                  titleError={titleError}
                  onTitle={setTitle}
                  onTitleBlur={blur("title")}
                  text={text}
                  textPlaceholder={hints.text}
                  onText={setText}
                  onTextBlur={blur("text")}
                  cities={cities}
                  cityId={cityId}
                  cityError={cityError}
                  onCity={(city) => { setPickedState(city?.stateSlug ?? ""); setCityId(city?.id ?? ""); setDistrictId(""); }}
                  onCityBlur={blur("city")}
                  districts={districts}
                  districtId={districtId}
                  onDistrict={setDistrictId}
                  interests={picksOf(attrs[INTEREST_KEY])}
                  popular={popularInterests}
                  onInterests={(next) => setAttrs((prev) => ({ ...prev, [INTEREST_KEY]: next }))}
                  summary={summaryItems}
                  summaryTick={summaryTick}
                  onEditing={setEditingPart}
                >
                  {split ? null : renderNewExtras(err, blur)}
                </DetailsStep>
              ) : null}

              {current === "more" ? <div className="tkp-fields">{renderNewExtras(err, blur)}</div> : null}

              {current === "photos" ? (
                <PhotoStep listingId={draftId} copy={copy} allowVideo={!people} onMedia={handleMedia} onBusy={setPhotoBusy} />
              ) : null}

              {current === "contact" ? (
                <AboutYouStep
                  nickname={nickname}
                  age={ageField ? { value: age, required: Boolean(ageField.required) } : undefined}
                  people={people}
                  phone={phone}
                  whatsapp={whatsapp}
                  whatsappSame={whatsappSame}
                  whatsappNumber={whatsappNumber}
                  telegramOn={telegramOn}
                  telegram={telegram}
                  error={err}
                  onBlur={blur}
                  onNickname={setNickname}
                  onAge={setAge}
                  onPhone={setPhone}
                  onWhatsapp={() => setWhatsapp((v) => !v)}
                  onWhatsappSame={() => setWhatsappSame((v) => !v)}
                  onWhatsappNumber={setWhatsappNumber}
                  onTelegramOn={() => setTelegramOn((v) => !v)}
                  onTelegram={setTelegram}
                >
                  {about?.askDateOfBirth ? (
                    <p className="tkp-note" data-tk="dob-needed">
                      {t("post.about.dobAway")}{" "}
                      <Link href={`/u/seller-profile/?next=${encodeURIComponent(postAdPath(paths))}`} data-tk="dob-link">{t("post.about.dobLink")}</Link>
                    </p>
                  ) : null}
                </AboutYouStep>
              ) : null}

              {buy ? (
                <BuyCreditsDialog
                  {...buy}
                  onClose={() => setBuy(null)}
                  onPaid={(newBalance) => {
                    publishAfterBuy.current = newBalance;
                    setBuy(null);
                  }}
                />
              ) : null}
              {current === "review" ? (
                <ReviewStep
                  rows={reviewRows}
                  title={title.trim() || t("post.review.noTitle")}
                  place={listPlace}
                  thumb={coverUrl}
                  note={editing ? (draftStatus === "paused" ? t("post.note.paused") : t("post.note.saved")) : ""}
                  cost={cost}
                  options={alreadyPaid ? null : <BoostChoice onChange={setBoost} />}
                  video={alreadyPaid ? null : <VideoCallRow boosted={Boolean(boostPlan)} on={!videoCallsOff} onToggle={() => setVideoCallsOff((v) => !v)} earn={earn} />}
                  low={low}
                  listInline={listPreview("inline")}
                  earnInline={<EarnPanel state={earnState} earn={earn} />}
                  terms={terms}
                  showAdult={!adultAccepted}
                  adult={adult}
                  termsError={errors.terms}
                  adultError={errors.adult}
                  onEdit={(target) => {
                    returnToReview.current = true;
                    if (draftId) remember(draftId, target);
                    else setStep(target);
                  }}
                  onTerms={() => setTerms((v) => !v)}
                  onAdult={() => setAdult((v) => !v)}
                />
              ) : null}
            </div>

            <div className="tkp-nav">
                {step > 1 ? (
                  <button type="button" className="tkp-btn" onClick={() => (draftId ? remember(draftId, step - 1) : setStep(step - 1))}>
                    <svg className="tkp-back-ic" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
                    <span className="tkp-back-txt">{stepCopy.backLabel || t("post.nav.back")}</span>
                  </button>
                ) : <span />}
                <div className="tkp-nav-right">
                  {current === "review" && totalShort > 0 ? (
                    <button type="button" className="tkp-btn tkp-btn-primary" data-tk="go-on" onClick={() => openBuy(totalShort)}>{t("post.v2.rev.buyContinue")}</button>
                  ) : current === "review" ? (
                    <button type="button" className="tkp-btn tkp-btn-primary" data-tk="go-on" disabled={busy || !hydrated || !title.trim()} onClick={publish}>
                      {editing ? stepCopy.nextLabel || t("post.nav.publishAd") : publishText}
                    </button>
                  ) : (
                    <button type="button" className="tkp-btn tkp-btn-primary" data-tk="go-on" disabled={busy || (current === "category" && !categoryReady) || (current === "photos" && photoBusy)} onClick={() => continueFrom(current)}>
                      {current === "photos" && photoCount === 0 ? t("post.v2.ph.skip") : stepCopy.nextLabel || t("post.nav.continue")}
                    </button>
                  )}
                </div>
              </div>
          </section>
          <aside className="tkp-aside" data-step={current}>
            {current === "category" ? (
              renderCategoryPreview("side")
            ) : current === "review" ? (
              <>
                {listPreview("side")}
                <EarnPanel state={earnState} earn={earn} />
              </>
            ) : current === "details" || current === "photos" || current === "contact" ? (
              <>
                <p className="tkd-pv-label">{t("post.v2.det.preview")}</p>
                {detailsCard}
                <p className="tkd-pv-hint">{current === "photos" ? t("post.v2.ph.previewHint") : t("post.v2.det.previewHint")}</p>
                {current === "photos" ? <PhotoGuidelines where="side" /> : null}
              </>
            ) : (
              <>
                <p className="tkp-aside-label">{t("post.aside.live")}</p>
                <PostPreviewCard ad={adPreview} label={t("post.aside.live")} hasPhoto={Boolean(coverUrl)} byline={byline} />
                <p className="tkp-preview-line">{t("post.aside.howItLooks")}</p>
                <PostTip text={t(NEW_POST_TIP_KEYS[current === "more" ? "details" : current])} />
              </>
            )}
          </aside>
        </div>
        {money.added ? <div className="tkp-toast" role="status" data-tk="credits-toast">{creditsText(money.added)} {t("post.money.added")}</div> : null}
        {previewOpen ? <PreviewSheet ad={adPreview} hasPhoto={Boolean(coverUrl)} byline={byline} card={current === "details" || current === "photos" || current === "contact" ? detailsCard : undefined} onClose={() => setPreviewOpen(false)} /> : null}
      </div>
      </PostShell>
    );
  }
}

function SuccessLink({ cta, fallback }: { cta: CtaCopy; fallback: string }) {
  return <Link href={cta.href || fallback} style={{ color: "var(--accent)" }}>{cta.label}</Link>;
}

function Group({ title, help, children }: { title: string; help?: string; children: React.ReactNode }) {
  const t = useT();
  return (
    <section style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h2 className="tk-group-h">{title}</h2>
        <span className="t-caption" style={{ color: "var(--muted)" }}>{t("post.form.required")}</span>
      </div>
      <div className="tk-form-panel">
        {help ? <p className="t-small">{help}</p> : null}
        {children}
      </div>
    </section>
  );
}
