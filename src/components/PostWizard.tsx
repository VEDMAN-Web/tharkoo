"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { api, fieldErrors, friendlyError } from "@/lib/ui/api";
import { loadPostSubcategories, type PostSubcategory } from "@/server/categories/actions";
import { PhotoStep } from "@/components/post/PhotoStep";
import { PickGroup } from "@/components/post/PickGroup";
import { NEW_POST_STEPS, cleanAttrs, DEFAULT_PICK_LIMIT, draftToForm, errorsForStep, needsIdCheck, picksOf, telegramHandle, textOf, validateAbout, validateContact, validatePost, type NewPostStep, type PostAttrs, type SavedDraft } from "@/lib/ui/post-form";
import { loginPath, postAdPath } from "@/lib/urls";
import { useUrlPaths } from "./UrlPaths";
import { HelpCard } from "./ui/HelpCard";
import { AdCard } from "./ui/AdCard";
import { POST_COPY_DEFAULTS, wizardFields, type CtaCopy, type PostCopy } from "./post/copy";
import { newStepCopy, newSuccessCopy } from "./post/newCopy";
import { SelectField, Switch, TextField } from "./post/FormFields";
import { ContactFields } from "./post/ContactFields";
import { AboutYou } from "./post/AboutYou";
import { ReviewStep, type ReviewRow } from "./post/ReviewStep";
import { PostSuccess } from "./post/PostSuccess";
import { NEW_POST_TIPS, PostRail, PostTip, RAIL_LABELS, type RailItem } from "./post/NewPostParts";
import { CategoryTiles } from "./post/CategoryTiles";
import { hintsFor, photoHelp } from "./post/placeholders";
import { listDraftMediaAction } from "./post/mediaActions";
import type { DraftMedia } from "@/server/media/mine";
import { PostPreviewCard, PreviewSheet, previewAd } from "./post/PostPreview";
import "./post/post-wizard.css";
import type { ListingDoc } from "@/lib/models";

type Cat = { _id: string; name: string; slug: string; people?: boolean; kind?: string; fields?: Record<string, unknown>[] };
type Place = { id: string; name: string; slug: string; parentId?: string | null };

/** Step number of the photo step in each design. `?step=photos` in the URL means this step. */
const OLD_PHOTO_STEP = 2;
const NEW_PHOTO_STEP = 3;
const NEW_CONTACT_STEP = 4;
const NEW_REVIEW_STEP = 5;

function tidy(value: string) {
  return value.replace(/[\s-]/g, "");
}

function normalPhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  return tidy(raw);
}

/** H7.5: the price as whole rupees, digits only. Empty when nothing usable was typed. */
function priceDigitsOf(raw: string) {
  return raw.replace(/[,\s]/g, "");
}

export function PostWizard({
  copy = POST_COPY_DEFAULTS,
  requireIdCheck = false,
  newDesign = false,
  initialCategories,
  initialCities,
  defaultCityId = "",
  defaultName = "",
  maskedEmail = "",
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
  maskedEmail?: string;
  about?: { askDateOfBirth: boolean } | null;
}) {
  const paths = useUrlPaths();
  const lastStep = newDesign ? NEW_POST_STEPS.length : 3;
  const photoStep = newDesign ? NEW_PHOTO_STEP : OLD_PHOTO_STEP;
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState<Cat[]>(initialCategories ?? []);
  const [cities, setCities] = useState<Place[]>(initialCities ?? []);
  const [districts, setDistricts] = useState<Place[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [subsByCategory, setSubsByCategory] = useState<Record<string, PostSubcategory[]>>({});
  const [subcategoryId, setSubcategoryId] = useState("");
  const [cityId, setCityId] = useState(defaultCityId);
  const [districtId, setDistrictId] = useState("");
  const [address, setAddress] = useState("");
  const [postal, setPostal] = useState("");
  const [area, setArea] = useState("");
  const [age, setAge] = useState("");
  const [nickname, setNickname] = useState(defaultName.slice(0, 20));
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [price, setPrice] = useState("");
  const [contactMode, setContactMode] = useState("both");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState(false);
  const [whatsappSame, setWhatsappSame] = useState(true);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [telegramOn, setTelegramOn] = useState(false);
  const [telegram, setTelegram] = useState("");
  const [terms, setTerms] = useState(false);
  const [adult, setAdult] = useState(false);
  const [attrs, setAttrs] = useState<PostAttrs>({});
  const [draftId, setDraftId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [plans, setPlans] = useState<{ id: string; code?: string; name: string; amount?: number }[]>([]);
  const [hydrated, setHydrated] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showAll, setShowAll] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoCount, setPhotoCount] = useState<number | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [publishedStatus, setPublishedStatus] = useState("");
  const draftRef = useRef("");
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  const category = categories.find((item) => item._id === categoryId);
  const people = Boolean(category?.people) || category?.kind === "people";
  const subOptions = subsByCategory[categoryId] ?? [];
  const fields = useMemo(() => wizardFields(category?.fields), [category]);
  const ageField = fields.find((field) => field.key === "age" || field.type === "number" && /age/i.test(field.label));
  const extra = fields.filter((field) => field.key !== "age" && !/age/i.test(field.label));
  const { steps } = copy;
  const stepTitles = [steps.basics.title, steps.photos.title, steps.review.title];
  const visiblePlans = copy.promotion.products.length
    ? plans.filter((plan) => copy.promotion.products.some((code) => code === plan.id || code === plan.code))
    : plans;
  const cityName = cities.find((item) => item.id === cityId)?.name ?? "";
  const districtName = districts.find((item) => item.id === districtId)?.name ?? "";
  const priceDigits = priceDigitsOf(price);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const raw = sp.get("step") || "1";
    const next = raw === "photos" ? photoStep : Number(raw);
    const draft = sp.get("draft") || "";
    const id = window.setTimeout(() => {
      if (next >= 1 && next <= lastStep) setStep(next);
      if (draft) {
        setDraftId(draft);
        setHydrated(false);
        api<SavedDraft>(`/api/listings/by-id/${draft}`).then((res) => {
          if (res.ok && res.data) {
            const form = draftToForm(res.data);
            setCategoryId(form.categoryId);
            setSubcategoryId(form.subcategoryId);
            setCityId(form.cityId);
            setDistrictId(form.districtId);
            setAddress(form.address);
            setPostal(form.postal);
            setArea(form.area);
            setAge(form.age);
            setNickname(form.nickname);
            setTitle(form.title);
            setText(form.text);
            setPrice(form.price);
            setPhone(form.phone);
            setWhatsapp(form.whatsapp);
            setWhatsappNumber(form.whatsappNumber);
            setWhatsappSame(!form.whatsappNumber || form.whatsappNumber === form.phone);
            setContactMode(form.contactMode);
            setTelegram(form.telegram);
            setTelegramOn(Boolean(form.telegram));
            setAttrs(form.attrs);
            setTerms(true);
            setAdult(true);
          } else setBanner("This draft could not be loaded. Go back and save it again.");
          setHydrated(true);
        }).catch(() => {
          setBanner("This draft could not be loaded. Go back and save it again.");
          setHydrated(true);
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
      api<{ products: { id: string; code?: string; name: string; amount?: number }[] }>("/api/promotions/products").then((res) => {
        if (res.ok) setPlans(res.data.products || []);
      });
    }
    return () => window.clearTimeout(id);
  }, [lastStep, photoStep, initialCategories, initialCities]);

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
      fields: extra.map((field) => ({ key: field.key, label: field.label, required: field.required })),
    });
    if (phone && contactMode !== "email" && !/^\+91[6-9]\d{9}$/.test(normalPhone(phone))) next.phone = "Use +91 and 10 digits";
    if (newDesign && price.trim() && !/^\d{1,9}$/.test(priceDigits)) next.price = "Use whole rupees, numbers only";
    if (newDesign) Object.assign(next, validateContact({ mode: contactMode, whatsappOn: whatsapp, whatsappSame, whatsappNumber, telegramOn, telegram }));
    if (about) Object.assign(next, validateAbout({ askDateOfBirth: about.askDateOfBirth, dateOfBirth, ageConfirmed }));
    return next;
  }

  useEffect(() => {
    if (done) window.scrollTo(0, 0);
  }, [done]);

  const handleMedia = useCallback((media: DraftMedia) => {
    const cover = media.photos.find((photo) => photo.id === media.coverId) ?? media.photos[0];
    setCoverUrl(cover?.url ?? null);
    setPhotoCount(media.photos.length);
  }, []);

  useEffect(() => {
    if (!newDesign || !draftId || step === 3) return;
    let live = true;
    void listDraftMediaAction(draftId).then((media) => {
      if (live && media) handleMedia(media);
    });
    return () => {
      live = false;
    };
  }, [newDesign, draftId, step, handleMedia]);

  function remember(id: string, nextStep: number) {
    setTouched({});
    setShowAll(false);
    const url = `${postAdPath(paths)}?step=${nextStep}&draft=${id}`;
    window.history.replaceState(null, "", url);
    setStep(nextStep);
  }

  function showErrors(found: Record<string, string>) {
    setErrors(found);
    setBanner("");
    setShowAll(Object.keys(found).length > 0);
    if (Object.keys(found).length) document.querySelector("[data-tk=field-error]")?.scrollIntoView({ block: "center" });
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
    if (!created.ok) {
      if (quiet) {
        setSaveState("idle");
        return "";
      }
      setBusy(false);
      setBanner(created.error.code === "UNAUTHORIZED" ? "Sign in to save this draft." : friendlyError(created.error));
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
        ...(newDesign ? { price: people ? null : priceDigits || null } : {}),
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
      const valid = Boolean(categoryId) && (subOptions.length === 0 || Boolean(subcategoryId)) && title.trim().length >= 5 && text.trim().length >= 20 && Boolean(cityId);
      if (!newDesign || !hydrated || step > 2 || !valid || done) return;
      void saveAll(false, true).then((id) => {
        if (id) window.history.replaceState(null, "", `${postAdPath(paths)}?step=${step}&draft=${id}`);
      });
    };
  });

  useEffect(() => {
    if (!newDesign) return;
    const id = window.setTimeout(() => saveLatest.current(), 800);
    return () => window.clearTimeout(id);
  }, [newDesign, categoryId, subcategoryId, cityId, districtId, title, text, price, nickname, age, attrs]);

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
        ...(about.askDateOfBirth ? { dateOfBirth, adultConfirmed: ageConfirmed } : {}),
      }),
    });
    setBusy(false);
    if (res.ok) return true;
    const keyOf: Record<string, string> = { name: "nickname", city: "city", dateOfBirth: "dob", whatsapp: "phone" };
    const found: Record<string, string> = {};
    for (const [key, messages] of Object.entries(fieldErrors(res.error))) {
      const message = Array.isArray(messages) ? messages[0] : String(messages || "");
      if (message) found[keyOf[key] ?? key] = message;
    }
    if (Object.keys(found).length) showErrors(found);
    else setBanner(res.error.code === "UNAUTHORIZED" ? "Sign in to save this draft." : friendlyError(res.error));
    return false;
  }

  async function continueFrom(from: NewPostStep) {
    if (!showErrors(errorsForStep(validate(), from, Boolean(about)))) return;
    if (from === "category") return setStep(2);
    if (from === "photos") return remember(draftId, NEW_CONTACT_STEP);
    if (from === "contact" && !(await saveAbout())) return;
    const id = await saveAll(from === "contact");
    if (id) remember(id, from === "details" ? NEW_PHOTO_STEP : NEW_REVIEW_STEP);
  }

  async function publish() {
    if (!hydrated) return setBanner("The draft is still loading.");
    if (!draftId || !title.trim()) return setBanner("Save a draft before submitting.");
    if (newDesign && !showErrors(errorsForStep(validate(), "review"))) return;
    setBusy(true);
    setBanner("");
    // H6.14: the ID check is asked for only when the switch is on. Off, the submit goes straight to the server.
    if (requireIdCheck) {
      const me = await api<{ verification?: { status?: string }; user?: { verificationStatus?: string } }>("/api/auth/me");
      const verification = me.ok ? me.data.verification?.status || me.data.user?.verificationStatus : "";
      if (needsIdCheck(verification)) {
        setBusy(false);
        setBanner("Your ID needs a quick check before this ad can go live.");
        return;
      }
    }
    const res = await api(`/api/listings/${draftId}/submit`, {
      method: "POST",
      body: JSON.stringify({ attestations: { adult: true, accurate: true, rights: true } }),
    });
    setBusy(false);
    if (!res.ok) {
      if (res.error.code === "VERIFICATION_REQUIRED") {
        setBanner("Your ID needs a quick check before this ad can go live.");
        return;
      }
      setBanner(friendlyError(res.error));
      return;
    }
    setPublishedStatus(String((res.data as { status?: string } | null)?.status ?? "active"));
    window.history.replaceState(null, "", postAdPath(paths));
    setDone(true);
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
    price: people || !priceDigits ? null : Number(priceDigits),
    cover: coverUrl,
  });
  const byline = people ? [nickname.trim(), age.trim()].filter(Boolean).join(", ") : "";

  if (done && newDesign) {
    const isLive = publishedStatus === "active";
    return (
      <PostSuccess
        copy={newSuccessCopy(copy, isLive)}
        live={isLive}
        where={[cityName, category?.name].filter(Boolean).join(" ")}
        ad={adPreview}
        hasPhoto={Boolean(coverUrl)}
        byline={byline}
        anotherHref={copy.success.secondaryCta?.href || postAdPath(paths)}
      />
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
      <p className="tk-step-of" data-tk="step-of">Step {step} of 3 · {stepTitles[step - 1]}</p>
      <div className="tk-step-head">
        <h1 className="tk-page-h1" data-tk="step-title" style={{ margin: 0 }}>
          {stepTitles[step - 1]}
        </h1>
      </div>
      {step === 1 && steps.basics.help ? <p className="t-small" data-tk="step-help">{steps.basics.help}</p> : null}
      <div aria-live="polite" className="t-small" style={{ color: "var(--danger)", margin: "12px 0" }}>
        {banner}{" "}
        {banner.startsWith("Sign in") ? <Link href={`${loginPath(paths)}?next=${encodeURIComponent(postAdPath(paths))}`}>Log in</Link> : null}
        {/ID needs a quick check/i.test(banner) ? <Link href="/u/account/kyc/" data-tk="verify-id">Verify ID</Link> : null}
      </div>
      {step === 1 ? (
        <>
          <Group title="Your Ad">
            <SelectField id="category" label="Select category" required value={categoryId} error={errors.category} onChange={(value) => { setCategoryId(value); setSubcategoryId(""); }}>
              <option value="">Select category</option>
              {categories.map((cat) => (
                <option key={cat._id} value={cat._id}>{cat.name}</option>
              ))}
            </SelectField>
            {subOptions.length > 0 ? (
              <SelectField id="subcategory" label="Select sub-category" required value={subcategoryId} error={errors.subcategory} onChange={setSubcategoryId}>
                <option value="">Select sub-category</option>
                {subOptions.map((sub) => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </SelectField>
            ) : null}
            <SelectField id="city" label="Select city" required value={cityId} error={errors.city} onChange={(value) => { setCityId(value); setDistrictId(""); }}>
              <option value="">Select city</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>{city.name}</option>
              ))}
            </SelectField>
            <SelectField id="district" label="Select district" value={districtId} error={errors.district} disabled={!cityId} onChange={setDistrictId}>
              <option value="">Select district</option>
              {districts.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </SelectField>
            <div className="tk-modal-grid">
              <TextField id="address" label="Address" value={address} onChange={setAddress} />
              <TextField id="postal" label="Postal code" value={postal} onChange={setPostal} />
            </div>
            <TextField id="area" label="Area/District/Neighbourhood" value={area} onChange={setArea} />
          </Group>
          <Group title={steps.details.title} help={steps.details.help}>
            {ageField ? <TextField id="age" label="Age" required value={age} error={errors.age} onChange={setAge} /> : null}
            <TextField id="nickname" label="Nickname" required value={nickname} error={errors.nickname} note="max 20 characters" placeholder="Insert your name or nickname" onChange={setNickname} />
            <TextField id="title" label="Title" required area value={title} error={errors.title} note="5 characters required" placeholder="Give your ad a good title" onChange={setTitle} />
            <TextField id="text" label="Text" required area rows={5} value={text} error={errors.text} note="20 characters required" placeholder="Use this space to describe your ad, what you offer and what you like ..." onChange={setText} />
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
        <PhotoStep listingId={draftId} copy={copy} onBack={() => remember(draftId, 1)} onNext={() => remember(draftId, 3)} />
      ) : null}
      {step === 3 ? (
        <>
          <div className="tk-form-panel">
            <h2 className="t-h3">Preview</h2>
            {hydrated && title.trim() ? <AdCard ad={preview as ListingDoc} /> : <p data-tk="draft-loading">{hydrated ? "This draft has no title yet." : "Loading your draft…"}</p>}
          </div>
          {copy.promoteHidden ? null : (
            <div className="tk-form-panel" style={{ marginTop: 16 }} data-tk="promote-step">
              <h2 className="t-h3">{steps.promote.title}</h2>
              {copy.promotion.title ? <p className="t-small" style={{ fontWeight: 600 }}>{copy.promotion.title}</p> : null}
              {steps.promote.help ? <p className="t-small">{steps.promote.help}</p> : null}
              {visiblePlans.length ? visiblePlans.map((plan) => (
                <p key={plan.id} className="t-small">{plan.name}{plan.amount !== undefined ? ` · Rs ${plan.amount}` : ""}</p>
              )) : (
                <p className="t-small">{copy.promotion.note} <Link href="/u/account/credits/" style={{ color: "var(--accent)" }}>Boost visibility</Link></p>
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
    return newDesign ? <div className="tkp-group">{rows}</div> : <Group title="About You">{rows}</Group>;
  }

  function renderContactFields() {
    return (
      <Group title={steps.contact.title} help={steps.contact.help}>
        <p className="t-small">How would you like to be contacted?</p>
        <div className="tk-radios">
          {[
            ["phone", "Only Phone"],
            ["email", "Only Email"],
            ["both", "Email and Phone"],
          ].map(([id, label]) => (
            <button key={id} type="button" className={`tk-radio ${contactMode === id ? "on" : ""}`} onClick={() => setContactMode(id)}>
              {label}
            </button>
          ))}
        </div>
        <TextField id="phone" label="Phone Number" required={contactMode !== "email"} value={phone} error={errors.phone} placeholder="+91 81234 56789" onChange={setPhone} />
        <div className="tk-switch-row"><span>WhatsApp</span><Switch on={whatsapp} onClick={() => setWhatsapp((v) => !v)} label="WhatsApp" /></div>
        <div className="tk-switch-row"><span>Telegram</span><Switch on={telegramOn} onClick={() => setTelegramOn((v) => !v)} label="Telegram" /></div>
        {telegramOn ? <TextField id="telegram" label="Telegram" value={telegram} onChange={setTelegram} /> : null}
      </Group>
    );
  }

  function renderConsents() {
    return (
      <>
        <p className={`t-small tk-consent tk-consent-first ${errors.terms ? "is-bad" : ""}`}>
          <input id="consent-terms" type="checkbox" className="tk-check" checked={terms} onChange={() => setTerms((v) => !v)} aria-invalid={Boolean(errors.terms)} />
          <label htmlFor="consent-terms">
          <strong>Terms, Conditions and Privacy Policy</strong> I have read the <Link href="/terms/">Terms and Conditions</Link> of use and <Link href="/privacy/">Privacy Policy</Link> and I hereby authorise the processing of my personal data for the purpose of providing this web service.
          </label>
          {errors.terms ? <span className="tk-error" data-tk="field-error">{errors.terms}</span> : null}
        </p>
        <p className={`t-small tk-consent ${errors.adult ? "is-bad" : ""}`}>
          <input id="consent-adult" type="checkbox" className="tk-check" checked={adult} onChange={() => setAdult((v) => !v)} aria-invalid={Boolean(errors.adult)} />
          <label htmlFor="consent-adult">I confirm that I am 18 or over, that the details in this ad are accurate, and that I own the rights to any photos I add.</label>
          {errors.adult ? <span className="tk-error" data-tk="field-error">{errors.adult}</span> : null}
        </p>
      </>
    );
  }

  /** H7.83: the New design. Five steps, a step rail, the live preview (the real ad card) and the tip. Logic is shared with the three-step form. */
  function renderNewDesign() {
    const current = NEW_POST_STEPS[step - 1] ?? "category";
    const stepCopy = newStepCopy(current, copy, Boolean(about));
    const railItems: RailItem[] = NEW_POST_STEPS.map((key, index) => ({
      key,
      label: RAIL_LABELS[key],
      num: index + 1,
      state: index + 1 < step ? "done" : index + 1 === step ? "current" : "todo",
      clickable: index + 1 < step ? true : index + 1 === step,
    }));
    const placeParts = [cityName, shownDistrict].filter(Boolean).join(" / ");
    const photoHelpLine = steps.photos.help === POST_COPY_DEFAULTS.steps.photos.help || !steps.photos.help ? photoHelp(people) : steps.photos.help;
    const headHelp = current === "photos" ? photoHelpLine : stepCopy.help;
    const previewPrice = priceDigits ? `₹${Number(priceDigits).toLocaleString("en-IN")}` : "";
    const hints = hintsFor(category?.slug);
    const subName = subOptions.find((sub) => sub.id === subcategoryId)?.name;
    const contactSummary = contactMode === "email" ? "Email only" : phone ? `${normalPhone(phone)}${contactMode === "both" ? " and email" : ""}` : "Not set";
    const reviewRows: ReviewRow[] = [
      { key: "category", label: "Category", value: [category?.name, subName].filter(Boolean).join(" › ") || "Not chosen", step: 1 },
      { key: "title", label: "Title", value: title.trim() || "No title yet", step: 2 },
      ...(people ? [] : [{ key: "price", label: "Price", value: previewPrice || "Not set", step: 2 }]),
      { key: "place", label: "Place", value: placeParts || "Not set", step: 2 },
      { key: "name", label: "Name on your ads", value: byline || nickname.trim() || "Not set", step: about ? NEW_CONTACT_STEP : 2 },
      { key: "photos", label: "Photos", value: photoCount === null ? (draftId ? "Checking" : "No photos yet") : photoCount ? `${photoCount} ${photoCount === 1 ? "photo" : "photos"}` : "No photos yet", step: NEW_PHOTO_STEP },
      { key: "contact", label: "Contact", value: contactSummary, step: NEW_CONTACT_STEP },
    ];
    const categoryReady = Boolean(categoryId) && (subOptions.length === 0 || Boolean(subcategoryId));
    const live = errorsForStep(validate(), current, Boolean(about));
    const err = (key: string) => (showAll || touched[key] ? live[key] : undefined) ?? errors[key];
    const blur = (key: string) => () => setTouched((prev) => ({ ...prev, [key]: true }));
    return (
      <div className="tkp-post" data-design="post-new">
        <div className="tkp-top">
          <p className="tkp-top-title">Post an ad</p>
          <div className="tkp-top-actions">
            <span className="tkp-saved" data-state={saveState} data-tk="draft-saved" role="status">
              {saveState === "saving" ? "Saving…" : "Saved"}
            </span>
            <Link href="/u/account/ads/" className="tkp-exit" data-tk="exit-post">Exit</Link>
          </div>
        </div>
        <div className="tkp-progress" aria-hidden><i style={{ width: `${(step / NEW_POST_STEPS.length) * 100}%` }} /></div>
        <div className="tkp-grid">
          <PostRail
            items={railItems}
            progressLabel="Your progress"
            onGo={(num) => {
              if (num === step) return;
              if (draftId) remember(draftId, num);
              else setStep(num);
            }}
          />
          <section className="tkp-main" data-step={current} aria-labelledby="post-step-title" onFocusCapture={keepFocusedFieldVisible}>
            <div className="tkp-head">
              <p className="tkp-kicker" data-tk="step-of">Step {step} of {NEW_POST_STEPS.length}</p>
              <h1 id="post-step-title" className="tkp-h1" data-tk="step-title">{stepCopy.title}</h1>
              {headHelp ? <p className="tkp-help" data-tk="step-help">{headHelp}</p> : null}
              <div aria-live="polite" className="tkp-banner">
                {banner}{" "}
                {banner.startsWith("Sign in") ? <Link href={`${loginPath(paths)}?next=${encodeURIComponent(postAdPath(paths))}`}>Log in</Link> : null}
                {/ID needs a quick check/i.test(banner) ? <Link href="/u/account/kyc/" data-tk="verify-id">Verify ID</Link> : null}
              </div>
            </div>
            <div className="tkp-scroll" onKeyDown={moveOnEnter}>
              {current === "category" ? (
                <>
                  <CategoryTiles categories={categories} selectedId={categoryId} onPick={(id) => { setCategoryId(id); setSubcategoryId(""); }} />
                  {errors.category ? <p className="tk-error" data-tk="field-error">{errors.category}</p> : null}
                  {subOptions.length > 0 ? (
                    <>
                      <p className="tkp-sub-title" id="sub-title">{category ? `Sub-category in ${category.name}` : "Sub-category"}</p>
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
                <div className="tkp-fields">
                  <div className="tkp-two tkp-two-keep">
                    <SelectField id="city" label="City" required value={cityId} error={err("city")} onBlur={blur("city")} onChange={(value) => { setCityId(value); setDistrictId(""); }}>
                      <option value="">Select city</option>
                      {cities.map((city) => (
                        <option key={city.id} value={city.id}>{city.name}</option>
                      ))}
                    </SelectField>
                    <SelectField id="district" label="Area" value={districtId} error={err("district")} disabled={!cityId} onChange={setDistrictId}>
                      <option value="">{cityId ? "Select area" : "Pick a city first"}</option>
                      {districts.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </SelectField>
                  </div>
                  <div className="tkp-two tkp-two-keep">
                    <TextField id="nickname" label="Nickname" required value={nickname} error={err("nickname")} onBlur={blur("nickname")} placeholder="Your name or nickname" onChange={(value) => setNickname(value.slice(0, 20))} />
                    {ageField ? <TextField id="age" label="Age" required={ageField.required} value={age} error={err("age")} onBlur={blur("age")} inputMode="numeric" placeholder="18 to 99" onChange={(value) => setAge(value.replace(/\D/g, "").slice(0, 2))} /> : <span />}
                  </div>
                  <TextField id="title" label="Ad title" required value={title} error={err("title")} onBlur={blur("title")} note={`${title.length} / 70`} placeholder={hints.title} onChange={(value) => setTitle(value.slice(0, 70))} />
                  <TextField id="text" label="Description" required area rows={4} value={text} error={err("text")} onBlur={blur("text")} note="20 characters or more" placeholder={hints.text} onChange={setText} />
                  {people ? null : <TextField id="price" label="Price (₹)" value={price} error={err("price")} onBlur={blur("price")} inputMode="numeric" placeholder="18,000" onChange={setPrice} />}
                  {renderExtraFields()}
                </div>
              ) : null}

              {current === "photos" ? (
                <PhotoStep listingId={draftId} copy={copy} onMedia={handleMedia} onBusy={setPhotoBusy} />
              ) : null}

              {current === "contact" ? (
                <div className="tkp-fields">
                  {about ? (
                    <AboutYou
                      nickname={nickname}
                      cityId={cityId}
                      cities={cities}
                      askDateOfBirth={about.askDateOfBirth}
                      dateOfBirth={dateOfBirth}
                      ageConfirmed={ageConfirmed}
                      error={err}
                      onBlur={blur}
                      onNickname={setNickname}
                      onCity={(value) => { setCityId(value); setDistrictId(""); }}
                      onDateOfBirth={setDateOfBirth}
                      onAgeConfirmed={() => setAgeConfirmed((v) => !v)}
                    />
                  ) : null}
                  <ContactFields
                    mode={contactMode}
                    maskedEmail={maskedEmail}
                    phone={phone}
                    whatsapp={whatsapp}
                    whatsappSame={whatsappSame}
                    whatsappNumber={whatsappNumber}
                    telegramOn={telegramOn}
                    telegram={telegram}
                    error={err}
                    onBlur={blur}
                    onMode={setContactMode}
                    onPhone={setPhone}
                    onWhatsapp={() => setWhatsapp((v) => !v)}
                    onWhatsappSame={() => setWhatsappSame((v) => !v)}
                    onWhatsappNumber={setWhatsappNumber}
                    onTelegramOn={() => setTelegramOn((v) => !v)}
                    onTelegram={setTelegram}
                  />
                </div>
              ) : null}

              {current === "review" ? (
                <ReviewStep
                  rows={reviewRows}
                  ad={adPreview}
                  hasPhoto={Boolean(coverUrl)}
                  byline={byline}
                  note="Your ad goes live as soon as you publish it. You can edit, pause or renew it from My ads."
                  terms={terms}
                  adult={adult}
                  termsError={errors.terms}
                  adultError={errors.adult}
                  onEdit={(target) => (draftId ? remember(draftId, target) : setStep(target))}
                  onTerms={() => setTerms((v) => !v)}
                  onAdult={() => setAdult((v) => !v)}
                />
              ) : null}
            </div>

            <div className="tkp-nav">
                {step > 1 ? (
                  <button type="button" className="tkp-btn" onClick={() => (draftId ? remember(draftId, step - 1) : setStep(step - 1))}>
                    {stepCopy.backLabel || "Back"}
                  </button>
                ) : <span />}
                <div className="tkp-nav-right">
                  {current === "review" ? null : <button type="button" className="tkp-btn tkp-btn-preview" data-tk="open-preview" onClick={() => setPreviewOpen(true)}>Preview</button>}
                  {current === "review" ? (
                    <button type="button" className="tkp-btn tkp-btn-primary" data-tk="go-on" disabled={busy || !hydrated || !title.trim()} onClick={publish}>
                      {stepCopy.nextLabel || "Publish ad"}
                    </button>
                  ) : (
                    <button type="button" className="tkp-btn tkp-btn-primary" data-tk="go-on" disabled={busy || (current === "category" && !categoryReady) || (current === "photos" && photoBusy)} onClick={() => continueFrom(current)}>
                      {stepCopy.nextLabel || "Continue"}
                    </button>
                  )}
                </div>
              </div>
          </section>
          <aside className="tkp-aside">
            <p className="tkp-aside-label">Live preview</p>
            <PostPreviewCard ad={adPreview} label="Live preview" hasPhoto={Boolean(coverUrl)} byline={byline} />
            <p className="tkp-preview-line">This is how your ad will look. Posting is free.</p>
            <PostTip text={NEW_POST_TIPS[current]} />
          </aside>
        </div>
        {previewOpen ? <PreviewSheet ad={adPreview} hasPhoto={Boolean(coverUrl)} byline={byline} onClose={() => setPreviewOpen(false)} /> : null}
      </div>
    );
  }
}

function SuccessLink({ cta, fallback }: { cta: CtaCopy; fallback: string }) {
  return <Link href={cta.href || fallback} style={{ color: "var(--accent)" }}>{cta.label}</Link>;
}

function Group({ title, help, children }: { title: string; help?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h2 className="tk-group-h">{title}</h2>
        <span className="t-caption" style={{ color: "var(--muted)" }}>* Required fields</span>
      </div>
      <div className="tk-form-panel">
        {help ? <p className="t-small">{help}</p> : null}
        {children}
      </div>
    </section>
  );
}
