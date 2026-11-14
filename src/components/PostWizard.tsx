"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, fieldErrors, friendlyError } from "@/lib/ui/api";
import { loadPostSubcategories, type PostSubcategory } from "@/server/categories/actions";
import { PhotoStep } from "@/components/post/PhotoStep";
import { draftToForm, needsIdCheck, validatePost, type SavedDraft } from "@/lib/ui/post-form";
import { loginPath, postAdPath } from "@/lib/urls";
import { useUrlPaths } from "./UrlPaths";
import { HelpCard } from "./ui/HelpCard";
import { POST_COPY_DEFAULTS, wizardFields, type CtaCopy, type PostCopy, type PostStepKey } from "./post/copy";
import { CategoryTiles, Group, PostRail, SelectField, Switch, TextField } from "./post/PostFields";
import { PostPreview } from "./post/PostPreview";

type Cat = { _id: string; name: string; slug: string; fields?: Record<string, unknown>[] };
type Place = { id: string; name: string; slug: string; parentId?: string | null };
type ServerError = Parameters<typeof fieldErrors>[0];

/** H6.19: the five steps the person sees, in order. Each maps to one post-step block in the layout editor. */
const STEP_KEYS: PostStepKey[] = ["basics", "details", "photos", "contact", "review"];
const STEP_COUNT = STEP_KEYS.length;

function tidy(value: string) {
  return value.replace(/[\s-]/g, "");
}

function normalPhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  return tidy(raw);
}

function pick(found: Record<string, string>, keys: string[]) {
  return Object.fromEntries(Object.entries(found).filter(([key]) => keys.includes(key)));
}

export function PostWizard({ copy = POST_COPY_DEFAULTS, requireIdCheck = false }: { copy?: PostCopy; requireIdCheck?: boolean }) {
  const paths = useUrlPaths();
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
  const [contactMode, setContactMode] = useState("both");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState(false);
  const [telegramOn, setTelegramOn] = useState(false);
  const [telegram, setTelegram] = useState("");
  const [terms, setTerms] = useState(false);
  const [adult, setAdult] = useState(false);
  const [attrs, setAttrs] = useState<Record<string, string>>({});
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
  const stepTitles = STEP_KEYS.map((key) => steps[key].title);
  const cityName = cities.find((city) => city.id === cityId)?.name ?? "";
  const visiblePlans = copy.promotion.products.length
    ? plans.filter((plan) => copy.promotion.products.some((code) => code === plan.id || code === plan.code))
    : plans;

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const next = Number(sp.get("step") || "1");
    const draft = sp.get("draft") || "";
    const id = window.setTimeout(() => {
      if (next >= 1 && next <= STEP_COUNT) setStep(next);
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
  }, []);

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
    return next;
  }

  /** The keys each step is responsible for, so a step only blocks on its own fields. */
  function stepKeys(which: number): string[] {
    if (which === 1) return ["category", "subcategory", "city"];
    if (which === 2) return ["nickname", "title", "text", "age", ...extra.map((field) => field.key)];
    if (which === 4) return ["phone"];
    if (which === 5) return ["terms", "adult"];
    return [];
  }

  function go(nextStep: number) {
    setErrors({});
    setBanner("");
    setStep(nextStep);
  }

  function remember(id: string, nextStep: number) {
    const url = `${postAdPath(paths)}?step=${nextStep}&draft=${id}`;
    window.history.replaceState(null, "", url);
    go(nextStep);
  }

  function showServerErrors(error: ServerError) {
    const mapped = fieldErrors(error);
    const nextErrors: Record<string, string> = {};
    for (const [key, messages] of Object.entries(mapped)) {
      const text = Array.isArray(messages) ? messages[0] : String(messages || "");
      if (text) nextErrors[key] = text;
    }
    if (Object.keys(nextErrors).length) setErrors(nextErrors);
    setBanner(Object.values(nextErrors)[0] || friendlyError(error));
  }

  function handleSaveError(error: ServerError) {
    if (error.code === "UNAUTHORIZED") {
      setBanner("Sign in to save this draft.");
      return;
    }
    setBanner(friendlyError(error));
  }

  /** Step 2 save: creates the draft on first run, then saves the title, text, nickname and category answers. */
  async function saveDetails(): Promise<string | null> {
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
      handleSaveError(created.error);
      return null;
    }
    const id = draftId || String((created.data as { id?: string })?.id || "");
    setDraftId(id);
    const details = await api(`/api/listings/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        stage: "details",
        attributes: { ...attrs, ...(age ? { age: Number(age) } : {}) },
        nickname,
      }),
    });
    if (!details.ok) {
      showServerErrors(details.error);
      return null;
    }
    return id;
  }

  /** Step 4 save: the contact details on the draft. */
  async function saveContact(id: string): Promise<boolean> {
    const contact = {
      ...(phone ? { phone: normalPhone(phone) } : {}),
      ...(whatsapp && phone ? { whatsapp: normalPhone(phone) } : {}),
      ...(telegramOn && telegram ? { telegram } : {}),
    };
    const res = await api(`/api/listings/${id}`, { method: "PATCH", body: JSON.stringify({ stage: "details", contact }) });
    if (!res.ok) {
      showServerErrors(res.error);
      return false;
    }
    return true;
  }

  async function next() {
    const found = pick(validate(), stepKeys(step));
    setErrors(found);
    setBanner("");
    if (Object.keys(found).length) {
      document.querySelector("[data-tk=field-error]")?.scrollIntoView({ block: "center" });
      return;
    }
    if (step === 1) return go(2);
    if (step === 2) {
      setBusy(true);
      const id = await saveDetails();
      setBusy(false);
      if (id) remember(id, 3);
      return;
    }
    if (step === 3) return remember(draftId, 4);
    if (step === 4) {
      setBusy(true);
      const ok = await saveContact(draftId);
      setBusy(false);
      if (ok) remember(draftId, 5);
    }
  }

  async function publish() {
    if (!hydrated) return setBanner("The draft is still loading.");
    if (!draftId || !title.trim()) return setBanner("Save a draft before submitting.");
    const consent = pick(validate(), stepKeys(5));
    setErrors(consent);
    if (Object.keys(consent).length) return;
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

  const preview = (
    <PostPreview title={title} text={text} categoryName={category?.name ?? ""} cityName={cityName} nickname={nickname} />
  );

  if (done) {
    return (
      <div className="tk-container" style={{ padding: "24px 0 40px" }}>
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

  return (
    <div className="tk-container tk-glass-page tk-post-page" style={{ padding: "16px 0 40px" }}>
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
      <div className="tk-post-layout">
        <div className="tk-post-main">
          <PostRail items={stepTitles.map((label) => ({ label }))} step={step} />
          <p className="tk-step-of" data-tk="step-of">Step {step} of {STEP_COUNT} · {stepTitles[step - 1]}</p>
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
              <section className="tk-post-group">
                <h2 className="tk-group-h">Choose a category</h2>
                <div className="tk-form-panel">
                  <CategoryTiles categories={categories} value={categoryId} error={errors.category} onChange={(id) => { setCategoryId(id); setSubcategoryId(""); }} />
                  {subOptions.length > 0 ? (
                    <div>
                      <p className="t-small" style={{ fontWeight: 600 }}>Sub-category</p>
                      <div className="tk-chips" role="group" aria-label="Sub-category">
                        {subOptions.map((sub) => (
                          <button key={sub.id} type="button" className={`tk-choice ${subcategoryId === sub.id ? "on" : ""}`} aria-pressed={subcategoryId === sub.id} onClick={() => setSubcategoryId(sub.id)}>
                            {sub.name}
                          </button>
                        ))}
                      </div>
                      {errors.subcategory ? <span className="tk-error" data-tk="field-error">{errors.subcategory}</span> : null}
                    </div>
                  ) : null}
                </div>
              </section>
              <Group title="Where">
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
              <p className="tk-post-actions">
                <button type="button" className="tk-btn tk-btn-gold" data-tk="go-on" disabled={busy} onClick={next}>{steps.basics.nextLabel || "Continue"}</button>
              </p>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Group title={steps.details.title} help={steps.details.help}>
                {ageField ? <TextField id="age" label="Age" required value={age} error={errors.age} onChange={setAge} /> : null}
                <TextField id="nickname" label="Nickname" required value={nickname} error={errors.nickname} note="max 20 characters" placeholder="Insert your name or nickname" onChange={setNickname} />
                <TextField id="title" label="Title" required area value={title} error={errors.title} note="5 characters required" placeholder="Give your ad a good title" onChange={setTitle} />
                <TextField id="text" label="Text" required area rows={5} value={text} error={errors.text} note="20 characters required" placeholder="Use this space to describe your ad, what you offer and what you like ..." onChange={setText} />
              </Group>
              {extra.length ? (
                <Group title="About You">
                  {extra.map((field) =>
                    field.options && field.options.length > 8 ? (
                      <SelectField key={field.key} id={field.key} label={field.label} required={field.required} help={field.help} error={errors[field.key]} value={attrs[field.key] || ""} onChange={(value) => setAttrs((prev) => ({ ...prev, [field.key]: value }))}>
                        <option value="">{field.placeholder || "Choose"}</option>
                        {field.options.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </SelectField>
                    ) : field.options?.length ? (
                      <div key={field.key} className={errors[field.key] ? "is-bad" : ""} data-tk={field.key}>
                        <p className="t-small">{field.required ? "* " : ""}{field.label}</p>
                        {field.help ? <p className="t-caption" style={{ color: "var(--muted)" }}>{field.help}</p> : null}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, outline: errors[field.key] ? "1px solid var(--danger)" : undefined, borderRadius: 8, padding: errors[field.key] ? 8 : 0 }}>
                          {field.options.map((option) => (
                            <button key={option} type="button" className={`tk-choice ${attrs[field.key] === option ? "on" : ""}`} onClick={() => setAttrs((prev) => ({ ...prev, [field.key]: prev[field.key] === option ? "" : option }))}>
                              {option}
                            </button>
                          ))}
                        </div>
                        {errors[field.key] ? <span className="tk-error" data-tk="field-error">{errors[field.key]}</span> : null}
                      </div>
                    ) : (
                      <TextField key={field.key} id={field.key} label={field.label} required={field.required} note={field.help} placeholder={field.placeholder} error={errors[field.key]} value={attrs[field.key] || ""} onChange={(value) => setAttrs((prev) => ({ ...prev, [field.key]: value }))} />
                    ),
                  )}
                </Group>
              ) : null}
              <p className="tk-post-actions">
                <button type="button" className="tk-btn tk-btn-outline-gold" onClick={() => go(1)}>Back</button>{" "}
                <button type="button" className="tk-btn tk-btn-gold" data-tk="go-on" disabled={busy} onClick={next}>{steps.details.nextLabel || "Continue"}</button>
              </p>
            </>
          ) : null}

          {step === 3 ? (
            <PhotoStep listingId={draftId} copy={copy} onBack={() => remember(draftId, 2)} onNext={() => remember(draftId, 4)} />
          ) : null}

          {step === 4 ? (
            <>
              <Group title={steps.contact.title} help={steps.contact.help}>
                <p className="t-small">How would you like to be contacted?</p>
                <div className="tk-radios">
                  {[
                    ["phone", "Only Phone"],
                    ["email", "Only Email"],
                    ["both", "Email and Phone"],
                  ].map(([id, label]) => (
                    <button key={id} type="button" aria-pressed={contactMode === id} className={`tk-radio ${contactMode === id ? "on" : ""}`} onClick={() => setContactMode(id)}>
                      {label}
                    </button>
                  ))}
                </div>
                <TextField id="phone" label="Phone Number" required={contactMode !== "email"} value={phone} error={errors.phone} placeholder="+91 81234 56789" onChange={setPhone} />
                <div className="tk-switch-row"><span>WhatsApp</span><Switch on={whatsapp} onClick={() => setWhatsapp((v) => !v)} label="WhatsApp" /></div>
                <div className="tk-switch-row"><span>Telegram</span><Switch on={telegramOn} onClick={() => setTelegramOn((v) => !v)} label="Telegram" /></div>
                {telegramOn ? <TextField id="telegram" label="Telegram" value={telegram} onChange={setTelegram} /> : null}
              </Group>
              <p className="tk-post-actions">
                <button type="button" className="tk-btn tk-btn-outline-gold" onClick={() => remember(draftId, 3)}>Back</button>{" "}
                <button type="button" className="tk-btn tk-btn-gold" data-tk="go-on" disabled={busy} onClick={next}>{steps.contact.nextLabel || "Continue"}</button>
              </p>
            </>
          ) : null}

          {step === 5 ? (
            <>
              <div className="tk-form-panel tk-post-inline-preview">
                <h2 className="t-h3">Preview</h2>
                {hydrated && title.trim() ? preview : <p data-tk="draft-loading">{hydrated ? "This draft has no title yet." : "Loading your draft…"}</p>}
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
              <div className="tk-form-panel tk-post-consent" style={{ marginTop: 16 }}>
                <p className="t-small tk-post-lifetime" data-tk="lifetime-note">Your ad lasts 72 hours. You can renew it from your ads at any time.</p>
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
              </div>
              <p className="tk-post-actions">
                <button type="button" className="tk-btn tk-btn-outline-gold" onClick={() => remember(draftId, 4)}>{steps.review.backLabel || "Back"}</button>{" "}
                <button type="button" className="tk-btn tk-btn-gold" data-tk="go-on" disabled={busy || !hydrated || !title.trim()} onClick={publish}>{steps.review.nextLabel || "PUBLISH"}</button>
              </p>
            </>
          ) : null}
        </div>
        <aside className="tk-post-aside" aria-label="Live preview">
          {preview}
        </aside>
      </div>
      <HelpCard />
    </div>
  );
}

function SuccessLink({ cta, fallback }: { cta: CtaCopy; fallback: string }) {
  return <Link href={cta.href || fallback} style={{ color: "var(--accent)" }}>{cta.label}</Link>;
}

