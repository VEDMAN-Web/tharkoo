"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, fieldErrors, friendlyError } from "@/lib/ui/api";
import { loadPostSubcategories, type PostSubcategory } from "@/server/categories/actions";
import { PhotoStep } from "@/components/post/PhotoStep";
import { PickGroup } from "@/components/post/PickGroup";
import { NEW_POST_STEPS, cleanAttrs, DEFAULT_PICK_LIMIT, draftToForm, errorsForStep, needsIdCheck, picksOf, textOf, validatePost, type NewPostStep, type PostAttrs, type SavedDraft } from "@/lib/ui/post-form";
import { loginPath, postAdPath } from "@/lib/urls";
import { useUrlPaths } from "./UrlPaths";
import { HelpCard } from "./ui/HelpCard";
import { AdCard } from "./ui/AdCard";
import { POST_COPY_DEFAULTS, wizardFields, type CtaCopy, type PostCopy, type PostStepKey } from "./post/copy";
import { CATEGORY_TINTS, NEW_POST_TIPS, PostPreviewCard, PostRail, PostTip, type RailItem } from "./post/NewPostParts";
import type { ListingDoc } from "@/lib/models";

type Cat = { _id: string; name: string; slug: string; fields?: Record<string, unknown>[] };
type Place = { id: string; name: string; slug: string; parentId?: string | null };

/** H7.5: the New design step that reads each step's wording from the post-ad copy (see copy.ts). */
const NEW_STEP_COPY: Record<NewPostStep, PostStepKey> = {
  category: "basics",
  details: "details",
  photos: "photos",
  contact: "contact",
  review: "review",
};

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
}: {
  copy?: PostCopy;
  requireIdCheck?: boolean;
  /** H7.5: the New design switch. On shows the five-step form with the live preview. Off keeps the three-step form. */
  newDesign?: boolean;
}) {
  const paths = useUrlPaths();
  const lastStep = newDesign ? NEW_POST_STEPS.length : 3;
  const photoStep = newDesign ? NEW_PHOTO_STEP : OLD_PHOTO_STEP;
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState<Cat[]>([]);
  const [cities, setCities] = useState<Place[]>([]);
  const [districts, setDistricts] = useState<Place[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [subsByCategory, setSubsByCategory] = useState<Record<string, PostSubcategory[]>>({});
  const [subcategoryId, setSubcategoryId] = useState("");
  const [cityId, setCityId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [address, setAddress] = useState("");
  const [postal, setPostal] = useState("");
  const [area, setArea] = useState("");
  const [age, setAge] = useState("");
  const [nickname, setNickname] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [price, setPrice] = useState("");
  const [contactMode, setContactMode] = useState("both");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState(false);
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

  const category = categories.find((item) => item._id === categoryId);
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
    api<{ categories: Cat[] }>("/api/categories").then((res) => {
      if (res.ok) setCategories(res.data.categories || []);
    });
    loadPostSubcategories().then(setSubsByCategory).catch(() => setSubsByCategory({}));
    api<{ locations: Place[] }>("/api/locations?type=city").then((res) => {
      if (res.ok) setCities(res.data.locations || []);
    });
    if (document.cookie.split(";").some((part) => part.trim().startsWith("tk-in="))) {
      api<{ products: { id: string; code?: string; name: string; amount?: number }[] }>("/api/promotions/products").then((res) => {
        if (res.ok) setPlans(res.data.products || []);
      });
    }
    return () => window.clearTimeout(id);
  }, [lastStep, photoStep]);

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
    return next;
  }

  function remember(id: string, nextStep: number) {
    const url = `${postAdPath(paths)}?step=${nextStep}&draft=${id}`;
    window.history.replaceState(null, "", url);
    setStep(nextStep);
  }

  function showErrors(found: Record<string, string>) {
    setErrors(found);
    setBanner("");
    if (Object.keys(found).length) document.querySelector("[data-tk=field-error]")?.scrollIntoView({ block: "center" });
    return Object.keys(found).length === 0;
  }

  /**
   * Saves the basics and the details of the draft, creating it on the first save. Returns the draft id, or "" when
   * the save failed (the banner then says why). The contact is sent only when `includeContact` is set, so a save from
   * an earlier step never clears a phone number that was saved later.
   */
  async function saveAll(includeContact: boolean): Promise<string> {
    setBusy(true);
    const basics = {
      categoryId,
      title: title.trim(),
      description: text.trim(),
      ...(subcategoryId ? { subcategoryId } : {}),
      ...(cityId ? { cityId } : {}),
      ...(districtId ? { districtId } : {}),
    };
    const created = draftId
      ? await api(`/api/listings/${draftId}`, { method: "PATCH", body: JSON.stringify({ stage: "basics", ...basics }) })
      : await api<{ id: string }>("/api/listings", { method: "POST", body: JSON.stringify(basics) });
    if (!created.ok) {
      setBusy(false);
      setBanner(created.error.code === "UNAUTHORIZED" ? "Sign in to save this draft." : friendlyError(created.error));
      return "";
    }
    const id = draftId || String((created.data as { id?: string })?.id || "");
    setDraftId(id);
    const contact = {
      ...(phone ? { phone: normalPhone(phone) } : {}),
      ...(whatsapp && phone ? { whatsapp: normalPhone(phone) } : {}),
      ...(telegramOn && telegram ? { telegram } : {}),
    };
    const details = await api(`/api/listings/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        stage: "details",
        attributes: { ...cleanAttrs(attrs), ...(age ? { age: Number(age) } : {}) },
        nickname,
        ...(newDesign ? { price: priceDigits || null } : {}),
        ...(includeContact ? { contact } : {}),
      }),
    });
    setBusy(false);
    if (!details.ok) {
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
    return id;
  }

  /** The three-step form (New design off): one check of everything, then one save. */
  async function goOn() {
    if (!showErrors(validate())) return;
    const id = await saveAll(true);
    if (id) remember(id, OLD_PHOTO_STEP);
  }

  /** The five-step form (New design on): each step checks only its own fields and saves what it owns. */
  async function continueFrom(from: NewPostStep) {
    if (!showErrors(errorsForStep(validate(), from))) return;
    if (from === "category") return setStep(2);
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
    setDone(true);
  }

  const preview = useMemo(
    () => ({ slug: "preview", title, description: text, variant: "free", publicId: "preview" }),
    [title, text],
  );

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
            <button type="button" className="tk-btn tk-btn-gold" data-tk="go-on" disabled={busy} onClick={goOn}>{steps.basics.nextLabel}</button>
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
            <button type="button" className="tk-btn tk-btn-outline-gold" onClick={() => setStep(2)}>{steps.review.backLabel}</button>{" "}
            <button type="button" className="tk-btn tk-btn-gold" data-tk="go-on" disabled={busy || !hydrated || !title.trim()} onClick={publish}>{steps.review.nextLabel}</button>
          </p>
        </>
      ) : null}
      <HelpCard />
    </div>
  );

  /** The category fields the seller fills in (the "About You" group, or "More about it" in the New design). */
  function renderExtraFields() {
    if (!extra.length) return null;
    return (
      <Group title="About You">
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
      </Group>
    );
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

  /** H7.5: the New design. Five steps, a step rail, the live preview and the tip. Logic is shared with the three-step form. */
  function renderNewDesign() {
    const current = NEW_POST_STEPS[step - 1] ?? "category";
    const stepCopy = steps[NEW_STEP_COPY[current]];
    const railItems: RailItem[] = NEW_POST_STEPS.map((key, index) => ({
      key,
      label: steps[NEW_STEP_COPY[key]].title,
      num: index + 1,
      state: index + 1 < step ? "done" : index + 1 === step ? "current" : "todo",
      clickable: index + 1 < step ? true : index + 1 === step,
    }));
    const placeParts = [cityName, districtName].filter(Boolean).join(" / ");
    const previewPrice = priceDigits ? `₹${Number(priceDigits).toLocaleString("en-IN")}` : "";
    return (
      <div className="tkp-post" data-design="post-new">
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
          <section className="tkp-main" aria-labelledby="post-step-title">
            <p className="tkp-kicker" data-tk="step-of">Step {step} of {NEW_POST_STEPS.length}</p>
            <h1 id="post-step-title" className="tkp-h1" data-tk="step-title">{stepCopy.title}</h1>
            {stepCopy.help ? <p className="tkp-help" data-tk="step-help">{stepCopy.help}</p> : null}
            <div aria-live="polite" className="tkp-banner">
              {banner}{" "}
              {banner.startsWith("Sign in") ? <Link href={`${loginPath(paths)}?next=${encodeURIComponent(postAdPath(paths))}`}>Log in</Link> : null}
              {/ID needs a quick check/i.test(banner) ? <Link href="/u/account/kyc/" data-tk="verify-id">Verify ID</Link> : null}
            </div>

            {current === "category" ? (
              <>
                <div className="tkp-tiles" role="group" aria-label="Category">
                  {categories.map((cat, index) => {
                    const pressed = cat._id === categoryId;
                    const tint = CATEGORY_TINTS[index % CATEGORY_TINTS.length];
                    return (
                      <button
                        key={cat._id}
                        type="button"
                        className={`tkp-tile ${pressed ? "on" : ""}`}
                        aria-pressed={pressed}
                        onClick={() => { setCategoryId(cat._id); setSubcategoryId(""); }}
                      >
                        <span className="tkp-tile-mark" style={{ background: tint.tint, color: tint.ink }} aria-hidden>{cat.name.charAt(0).toUpperCase()}</span>
                        <span className="tkp-tile-name">{cat.name}</span>
                      </button>
                    );
                  })}
                </div>
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
                <div className="tkp-two">
                  <SelectField id="city" label="City" required value={cityId} error={errors.city} onChange={(value) => { setCityId(value); setDistrictId(""); }}>
                    <option value="">Select city</option>
                    {cities.map((city) => (
                      <option key={city.id} value={city.id}>{city.name}</option>
                    ))}
                  </SelectField>
                  <SelectField id="district" label="Area" value={districtId} error={errors.district} disabled={!cityId} onChange={setDistrictId}>
                    <option value="">Select area</option>
                    {districts.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </SelectField>
                </div>
                <TextField id="title" label="Ad title" required value={title} error={errors.title} note={`${title.length} / 70`} placeholder="For example: 2 BHK flat near Adajan" onChange={(value) => setTitle(value.slice(0, 70))} />
                <TextField id="text" label="Description" required area rows={5} value={text} error={errors.text} note="20 characters required" placeholder="Spacious 2 BHK on the 4th floor with lift and covered parking." onChange={setText} />
                <div className="tkp-two">
                  <TextField id="price" label="Price (₹)" value={price} error={errors.price} placeholder="18,000" onChange={setPrice} />
                  <TextField id="nickname" label="Nickname" required value={nickname} error={errors.nickname} note="max 20 characters" placeholder="Insert your name or nickname" onChange={setNickname} />
                </div>
                {ageField ? <TextField id="age" label="Age" required value={age} error={errors.age} onChange={setAge} /> : null}
                {renderExtraFields()}
              </div>
            ) : null}

            {current === "photos" ? (
              <PhotoStep listingId={draftId} copy={copy} onBack={() => remember(draftId, 2)} onNext={() => remember(draftId, NEW_CONTACT_STEP)} />
            ) : null}

            {current === "contact" ? (
              <div className="tkp-fields">
                <p className="tkp-sub-title">How would you like to be contacted?</p>
                <div className="tkp-chips" role="group" aria-label="How buyers reach you">
                  {[
                    ["phone", "Only Phone"],
                    ["email", "Only Email"],
                    ["both", "Email and Phone"],
                  ].map(([id, label]) => (
                    <button key={id} type="button" className={`tkp-chip ${contactMode === id ? "on" : ""}`} aria-pressed={contactMode === id} onClick={() => setContactMode(id)}>
                      {label}
                    </button>
                  ))}
                </div>
                <TextField id="phone" label="Phone number" required={contactMode !== "email"} value={phone} error={errors.phone} placeholder="+91 81234 56789" onChange={setPhone} />
                <div className="tkp-toggle-row"><span>WhatsApp</span><Switch on={whatsapp} onClick={() => setWhatsapp((v) => !v)} label="WhatsApp" /></div>
                <div className="tkp-toggle-row"><span>Telegram</span><Switch on={telegramOn} onClick={() => setTelegramOn((v) => !v)} label="Telegram" /></div>
                {telegramOn ? <TextField id="telegram" label="Telegram" value={telegram} onChange={setTelegram} /> : null}
              </div>
            ) : null}

            {current === "review" ? (
              <div className="tkp-fields">
                <dl className="tkp-summary">
                  <div><dt>Category</dt><dd>{[category?.name, subOptions.find((sub) => sub.id === subcategoryId)?.name].filter(Boolean).join(" › ") || "Not chosen"}</dd></div>
                  <div><dt>Title</dt><dd>{title.trim() || "No title yet"}</dd></div>
                  <div><dt>Price</dt><dd>{previewPrice || "Not set"}</dd></div>
                  <div><dt>Place</dt><dd>{placeParts || "Not set"}</dd></div>
                  <div><dt>Contact</dt><dd>{contactMode === "email" ? "Email only" : phone ? normalPhone(phone) : "Not set"}</dd></div>
                </dl>
                <p className="tkp-note">Your ad stays live for 72 hours after it is approved. You can renew it from your panel.</p>
                {renderConsents()}
              </div>
            ) : null}

            {current !== "photos" ? (
              <div className="tkp-nav">
                {step > 1 ? (
                  <button type="button" className="tkp-btn tkp-btn-ghost" onClick={() => (draftId ? remember(draftId, step - 1) : setStep(step - 1))}>
                    {stepCopy.backLabel || "Back"}
                  </button>
                ) : <span />}
                {current === "review" ? (
                  <button type="button" className="tkp-btn tkp-btn-primary" data-tk="go-on" disabled={busy || !hydrated || !title.trim()} onClick={publish}>
                    {stepCopy.nextLabel || "Publish ad"}
                  </button>
                ) : (
                  <button type="button" className="tkp-btn tkp-btn-primary" data-tk="go-on" disabled={busy} onClick={() => continueFrom(current)}>
                    {stepCopy.nextLabel || "Continue"}
                  </button>
                )}
              </div>
            ) : null}
          </section>
          <aside className="tkp-aside">
            <PostPreviewCard title={title.trim()} category={category?.name ?? ""} place={placeParts} price={previewPrice} previewLabel="Live preview" />
            <PostTip text={NEW_POST_TIPS[current]} />
          </aside>
        </div>
        <HelpCard />
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

function SelectField({
  id,
  label,
  required,
  value,
  error,
  disabled,
  help,
  onChange,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  value: string;
  error?: string;
  disabled?: boolean;
  help?: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className={`tk-field ${error ? "is-bad" : ""}`} htmlFor={id}>
      <span>{required ? "* " : ""}{label}</span>
      <select id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{children}</select>
      {help ? <span className="t-caption" style={{ color: "var(--muted)" }}>{help}</span> : null}
      {error ? <span className="tk-error" data-tk="field-error">{error}</span> : null}
    </label>
  );
}

function TextField({
  id,
  label,
  required,
  value,
  error,
  note,
  placeholder,
  area,
  rows,
  onChange,
}: {
  id: string;
  label: string;
  required?: boolean;
  value: string;
  error?: string;
  note?: string;
  placeholder?: string;
  area?: boolean;
  rows?: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className={`tk-field ${error ? "is-bad" : ""}`} htmlFor={id}>
      <span style={{ display: "flex", justifyContent: "space-between" }}>
        <span>{required ? "* " : ""}{label}</span>
        {note ? <span style={{ fontWeight: 500, color: "var(--muted)" }}>{note}</span> : null}
      </span>
      {area ? (
        <textarea id={id} rows={rows || 2} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input id={id} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      )}
      {error ? <span className="tk-error" data-tk="field-error">{error}</span> : null}
    </label>
  );
}

function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`tk-switch ${on ? "on" : ""}`} onClick={onClick}>
      <i />
    </button>
  );
}
