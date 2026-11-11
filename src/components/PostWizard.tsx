"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, fieldErrors, friendlyError } from "@/lib/ui/api";
import { draftToForm, needsIdCheck, validatePost, type SavedDraft } from "@/lib/ui/post-form";
import { loginPath, postAdPath } from "@/lib/urls";
import { useUrlPaths } from "./UrlPaths";
import { HelpCard } from "./ui/HelpCard";
import { AdCard } from "./ui/AdCard";
import type { ListingDoc } from "@/lib/models";

type Cat = { _id: string; name: string; slug: string; fields?: { key: string; label: string; type: string; options?: string[]; required?: boolean }[] };
type Place = { id: string; name: string; slug: string; parentId?: string | null };

function tidy(value: string) {
  return value.replace(/[\s-]/g, "");
}

function normalPhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  return tidy(raw);
}

export function PostWizard() {
  const paths = useUrlPaths();
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState<Cat[]>([]);
  const [cities, setCities] = useState<Place[]>([]);
  const [districts, setDistricts] = useState<Place[]>([]);
  const [categoryId, setCategoryId] = useState("");
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
  const [photoNote, setPhotoNote] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [plans, setPlans] = useState<{ id: string; name: string; amount?: number }[]>([]);
  const [hydrated, setHydrated] = useState(true);

  const category = categories.find((item) => item._id === categoryId);
  const ageField = category?.fields?.find((field) => field.key === "age" || field.type === "number" && /age/i.test(field.label));
  const extra = (category?.fields || []).filter((field) => field.key !== "age" && !/age/i.test(field.label));

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const next = Number(sp.get("step") || "1");
    const draft = sp.get("draft") || "";
    const id = window.setTimeout(() => {
      if (next >= 1 && next <= 3) setStep(next);
      if (draft) {
        setDraftId(draft);
        setHydrated(false);
        api<SavedDraft>(`/api/listings/by-id/${draft}`).then((res) => {
          if (res.ok && res.data) {
            const form = draftToForm(res.data);
            setCategoryId(form.categoryId);
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
            setPhotos(form.photos);
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
    api<{ locations: Place[] }>("/api/locations?type=city").then((res) => {
      if (res.ok) setCities(res.data.locations || []);
    });
    if (document.cookie.split(";").some((part) => part.trim().startsWith("tk-in="))) {
      api<{ products: { id: string; name: string; amount?: number }[] }>("/api/promotions/products").then((res) => {
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

  function remember(id: string, nextStep: number) {
    const url = `${postAdPath(paths)}?step=${nextStep}&draft=${id}`;
    window.history.replaceState(null, "", url);
    setStep(nextStep);
  }

  async function goOn() {
    const found = validate();
    setErrors(found);
    setBanner("");
    if (Object.keys(found).length) {
      document.querySelector("[data-tk=field-error]")?.scrollIntoView({ block: "center" });
      return;
    }
    setBusy(true);
    const basics = {
      categoryId,
      title: title.trim(),
      description: text.trim(),
      ...(cityId ? { cityId } : {}),
      ...(districtId ? { districtId } : {}),
    };
    const created = draftId
      ? await api(`/api/listings/${draftId}`, { method: "PATCH", body: JSON.stringify({ stage: "basics", ...basics }) })
      : await api<{ id: string }>("/api/listings", { method: "POST", body: JSON.stringify(basics) });
    if (!created.ok) {
      setBusy(false);
      if (created.error.code === "UNAUTHORIZED") {
        setBanner("Sign in to save this draft.");
        return;
      }
      setBanner(friendlyError(created.error));
      return;
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
        attributes: { ...attrs, ...(age ? { age: Number(age) } : {}) },
        contact,
      }),
    });
    setBusy(false);
    if (!details.ok) {
      const mapped = fieldErrors(details.error);
      const nextErrors: Record<string, string> = {};
      for (const [key, messages] of Object.entries(mapped)) {
        const text = Array.isArray(messages) ? messages[0] : String(messages || "");
        if (text) nextErrors[key] = text;
      }
      if (Object.keys(nextErrors).length) setErrors(nextErrors);
      setBanner(Object.values(nextErrors)[0] || friendlyError(details.error));
      return;
    }
    remember(id, 2);
  }

  async function uploadPhoto(file: File) {
    if (!draftId) {
      setPhotoNote("Save the ad details before adding a photo.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
      setPhotoNote("Use a JPG, PNG, or WebP photo up to 8 MB.");
      return;
    }
    const signed = await api<{
      uploadUrl: string;
      mediaId: string;
      mode?: string;
      apiKey?: string;
      timestamp?: number;
      signature?: string;
      folder?: string;
      params?: Record<string, string | number>;
    }>("/api/media/sign", {
      method: "POST",
      body: JSON.stringify({ listingId: draftId, contentType: file.type, byteSize: file.size, kind: "image" }),
    });
    if (!signed.ok) {
      setPhotoNote(friendlyError(signed.error));
      return;
    }
    if (signed.data.uploadUrl.startsWith("/")) {
      const body = new FormData();
      body.set("file", file);
      body.set("mediaId", signed.data.mediaId);
      const saved = await fetch(signed.data.uploadUrl, { method: "POST", body, credentials: "same-origin" });
      if (!saved.ok) {
        setPhotoNote("That photo could not be saved. Try a smaller JPG, PNG, or WebP.");
        return;
      }
    } else {
      const body = new FormData();
      body.set("file", file);
      body.set("api_key", signed.data.apiKey || "");
      body.set("timestamp", String(signed.data.timestamp || ""));
      body.set("signature", signed.data.signature || "");
      body.set("folder", signed.data.folder || "");
      for (const [key, value] of Object.entries(signed.data.params || {})) body.set(key, String(value));
      const saved = await fetch(signed.data.uploadUrl, { method: "POST", body });
      if (!saved.ok) {
        setPhotoNote("That photo could not be saved. Try a smaller JPG, PNG, or WebP.");
        return;
      }
      const done = await api("/api/media/complete", { method: "POST", body: JSON.stringify({ mediaId: signed.data.mediaId }) });
      if (!done.ok) {
        setPhotoNote(friendlyError(done.error));
        return;
      }
    }
    const ids = [...photos, signed.data.mediaId];
    setPhotos(ids);
    const attached = await api(`/api/listings/${draftId}`, {
      method: "PATCH",
      body: JSON.stringify({ stage: "photos", mediaIds: ids, coverMediaId: ids[0] }),
    });
    setPhotoNote(attached.ok ? "Photo saved." : friendlyError(attached.error));
  }

  async function publish() {
    if (!hydrated) return setBanner("The draft is still loading.");
    if (!draftId || !title.trim()) return setBanner("Save a draft before submitting.");
    setBusy(true);
    setBanner("");
    const me = await api<{ verification?: { status?: string }; user?: { verificationStatus?: string } }>("/api/auth/me");
    const verification = me.ok ? me.data.verification?.status || me.data.user?.verificationStatus : "";
    if (needsIdCheck(verification)) {
      setBusy(false);
      setBanner("Your ID needs a quick check before this ad can go live.");
      return;
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
      <div className="tk-container" style={{ padding: "24px 0 40px" }}>
        <h1 className="tk-page-h1" data-tk="step-title">Your ad is live</h1>
        <p style={{ textAlign: "center" }}>
          <Link href="/u/account/ads/" style={{ color: "var(--accent)" }}>Your ads</Link>
          {" · "}
          <Link href={postAdPath(paths)} style={{ color: "var(--accent)" }}>Post another ad</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="tk-container" style={{ padding: "16px 0 40px" }}>
      <div className="tk-progress" data-tk="progress" aria-hidden>
        <i className={step >= 1 ? "on" : ""} />
        <i className={step >= 2 ? "on" : ""} />
        <i className={step >= 3 ? "on" : ""} />
      </div>
      <p className="tk-step-of" data-tk="step-of">Step {step} of 3 · {step === 1 ? "Information" : step === 2 ? "Photos" : "Publish"}</p>
      <div className="tk-step-head">
        <h1 className="tk-page-h1" data-tk="step-title" style={{ margin: 0 }}>
          {step === 1 ? "Information" : step === 2 ? "Photos" : "Publish"}
        </h1>
      </div>
      <div aria-live="polite" className="t-small" style={{ color: "var(--danger)", margin: "12px 0" }}>
        {banner}{" "}
        {banner.startsWith("Sign in") ? <Link href={`${loginPath(paths)}?next=${encodeURIComponent(postAdPath(paths))}`}>Log in</Link> : null}
        {/ID needs a quick check/i.test(banner) ? <Link href="/u/account/kyc/" data-tk="verify-id">Verify ID</Link> : null}
      </div>
      {step === 1 ? (
        <>
          <Group title="Your Ad">
            <SelectField id="category" label="Select category" required value={categoryId} error={errors.category} onChange={(value) => setCategoryId(value)}>
              <option value="">Select category</option>
              {categories.map((cat) => (
                <option key={cat._id} value={cat._id}>{cat.name}</option>
              ))}
            </SelectField>
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
          <Group title="Your data">
            {ageField ? <TextField id="age" label="Age" required value={age} error={errors.age} onChange={setAge} /> : null}
            <TextField id="nickname" label="Nickname" required value={nickname} error={errors.nickname} note="max 20 characters" placeholder="Insert your name or nickname" onChange={setNickname} />
            <TextField id="title" label="Title" required area value={title} error={errors.title} note="5 characters required" placeholder="Give your ad a good title" onChange={setTitle} />
            <TextField id="text" label="Text" required area rows={5} value={text} error={errors.text} note="20 characters required" placeholder="Use this space to describe your ad, what you offer and what you like ..." onChange={setText} />
          </Group>
          {extra.length ? (
            <Group title="About You">
              {extra.map((field) =>
                field.options && field.options.length > 8 ? (
                  <SelectField key={field.key} id={field.key} label={field.label} required={field.required} error={errors[field.key]} value={attrs[field.key] || ""} onChange={(value) => setAttrs((prev) => ({ ...prev, [field.key]: value }))}>
                    <option value="">Choose</option>
                    {field.options.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </SelectField>
                ) : field.options?.length ? (
                  <div key={field.key} className={errors[field.key] ? "is-bad" : ""} data-tk={field.key}>
                    <p className="t-small">{field.required ? "* " : ""}{field.label}</p>
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
                  <TextField key={field.key} id={field.key} label={field.label} required={field.required} error={errors[field.key]} value={attrs[field.key] || ""} onChange={(value) => setAttrs((prev) => ({ ...prev, [field.key]: value }))} />
                ),
              )}
            </Group>
          ) : null}
          <Group title="Your contacts">
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
          <p className={`t-small tk-consent ${errors.terms ? "is-bad" : ""}`}>
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
          <p style={{ textAlign: "right", marginTop: 24 }}>
            <button type="button" className="tk-btn tk-btn-gold" data-tk="go-on" disabled={busy} onClick={goOn}>Continue</button>
          </p>
        </>
      ) : null}
      {step === 2 ? (
        <>
          <div className="tk-form-panel">
            <h2 className="t-h3">Your photos</h2>
            <div className="tk-drop">
              <p>Drag photos here or</p>
              <label className="tk-btn tk-btn-outline-gold">
                ADD PHOTOS
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  data-tk="photo-input"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void uploadPhoto(file);
                  }}
                />
              </label>
              <p className="t-small">JPG, PNG or WebP, 8 MB each.</p>
            </div>
            {photos.length ? <p className="t-small" data-tk="photo-count">{photos.length} photo{photos.length === 1 ? "" : "s"} saved</p> : null}
            {photoNote ? <p data-tk="photo-note">{photoNote}</p> : <p className="t-small">Add a photo of the item or place. People ads can use a portrait.</p>}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
            <button type="button" className="tk-btn tk-btn-outline-gold" onClick={() => remember(draftId, 1)}>BACK</button>
            <button type="button" className="tk-btn tk-btn-gold" data-tk="go-on" onClick={() => remember(draftId, 3)}>Continue</button>
          </div>
        </>
      ) : null}
      {step === 3 ? (
        <>
          <div className="tk-form-panel">
            <h2 className="t-h3">Preview</h2>
            {hydrated && title.trim() ? <AdCard ad={preview as ListingDoc} /> : <p data-tk="draft-loading">{hydrated ? "This draft has no title yet." : "Loading your draft…"}</p>}
          </div>
          <div className="tk-form-panel" style={{ marginTop: 16 }}>
            <h2 className="t-h3">Plan</h2>
            {plans.length ? plans.map((plan) => (
              <p key={plan.id} className="t-small">{plan.name}{plan.amount !== undefined ? ` · Rs ${plan.amount}` : ""}</p>
            )) : (
              <p className="t-small">Free: your ad is published once it passes our checks. <Link href="/u/account/credits/" style={{ color: "var(--accent)" }}>Boost visibility</Link></p>
            )}
          </div>
          <p style={{ textAlign: "right", marginTop: 16 }}>
            <button type="button" className="tk-btn tk-btn-outline-gold" onClick={() => setStep(2)}>BACK</button>{" "}
            <button type="button" className="tk-btn tk-btn-gold" data-tk="go-on" disabled={busy || !hydrated || !title.trim()} onClick={publish}>PUBLISH</button>
          </p>
        </>
      ) : null}
      <HelpCard />
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h2 className="tk-group-h">{title}</h2>
        <span className="t-caption" style={{ color: "var(--muted)" }}>* Required fields</span>
      </div>
      <div className="tk-form-panel">{children}</div>
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
  onChange,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  value: string;
  error?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className={`tk-field ${error ? "is-bad" : ""}`} htmlFor={id}>
      <span>{required ? "* " : ""}{label}</span>
      <select id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{children}</select>
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
