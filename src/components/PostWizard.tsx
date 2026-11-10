"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, fieldErrors, friendlyError } from "@/lib/ui/api";
import { HelpCard } from "./ui/HelpCard";
import { AdCard } from "./ui/AdCard";
import type { ListingDoc } from "@/lib/models";

type Cat = { _id: string; name: string; slug: string; fields?: { key: string; label: string; type: string; options?: string[]; required?: boolean }[] };
type Place = { id: string; name: string; slug: string; parentId?: string | null };

const TITLE_MSG = "You must enter at least 5 alphanumeric characters (a,b,c...z,0,1,2,3...)";

function tidy(value: string) {
  return value.replace(/[\s-]/g, "");
}

export function PostWizard() {
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
  const [plans, setPlans] = useState<{ id: string; name: string; amount?: number }[]>([]);

  const category = categories.find((item) => item._id === categoryId);
  const ageField = category?.fields?.find((field) => field.key === "age" || field.type === "number" && /age/i.test(field.label));
  const extra = (category?.fields || []).filter((field) => field.key !== "age" && !/age/i.test(field.label));

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const next = Number(sp.get("step") || "1");
    const draft = sp.get("draft") || "";
    const id = window.setTimeout(() => {
      if (next >= 1 && next <= 3) setStep(next);
      if (draft) setDraftId(draft);
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
    const next: Record<string, string> = {};
    if (!categoryId) next.category = "Please, fill in this field";
    if (!cityId) next.city = "Please, fill in this field";
    if (!nickname.trim()) next.nickname = "Name / Nickname is required";
    const alnum = (title.match(/[a-z0-9]/gi) || []).length;
    if (title.trim().length < 5 || alnum < 5) next.title = TITLE_MSG;
    if (text.trim().length < 20) next.text = "You must enter at least 20 characters";
    if (contactMode !== "email" && !tidy(phone)) next.phone = "If you want to be contacted by phone, please fill in this field";
    else if (phone && !/^\+91[6-9]\d{9}$/.test(tidy(phone))) next.phone = "If you want to be contacted by phone, please fill in this field";
    if (ageField && age && (Number(age) < 18 || Number(age) > 120)) next.age = "Invalid field";
    if (!terms) next.terms = "Please, fill in this field";
    if (!adult) next.adult = "Please, fill in this field";
    return next;
  }

  function remember(id: string, nextStep: number) {
    const url = `/u/post-insert/?step=${nextStep}&draft=${id}`;
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
      ...(phone ? { phone: tidy(phone) } : {}),
      ...(whatsapp && phone ? { whatsapp: tidy(phone) } : {}),
      ...(telegramOn && telegram ? { telegram } : {}),
    };
    const details = await api(`/api/listings/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ stage: "details", attributes: { nickname, ...attrs, ...(age ? { age } : {}) }, contact }),
    });
    setBusy(false);
    if (!details.ok) {
      const extraMsg = Object.values(fieldErrors(details.error)).flat()[0];
      setBanner(extraMsg || friendlyError(details.error));
      return;
    }
    remember(id, 2);
  }

  async function publish() {
    if (!draftId) return setBanner("Save a draft before submitting.");
    setBusy(true);
    setBanner("");
    const res = await api(`/api/listings/${draftId}/submit`, {
      method: "POST",
      body: JSON.stringify({ attestations: { adult: true, accurate: true, rights: true } }),
    });
    setBusy(false);
    if (!res.ok) {
      if (res.error.code === "VERIFICATION_REQUIRED") {
        setBanner("Verify your ID to publish");
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
        <h1 className="tk-page-h1" data-tk="step-title">Your ad has been sent for review</h1>
        <p style={{ textAlign: "center" }}>
          <Link href="/u/account/ads/" style={{ color: "var(--accent)" }}>Your ads</Link>
          {" · "}
          <Link href="/u/post-insert/" style={{ color: "var(--accent)" }}>Post another ad</Link>
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
      <div className="tk-step-head">
        <h1 className="tk-page-h1" data-tk="step-title" style={{ margin: 0 }}>
          {step === 1 ? "Information" : step === 2 ? "Photos" : "Publish"}
        </h1>
        <span className="tk-pill-count">{step}/3</span>
      </div>
      <div aria-live="polite" className="t-small" style={{ color: "var(--danger)", margin: "12px 0" }}>
        {banner}{" "}
        {banner.startsWith("Sign in") ? <Link href="/u/login/?next=/u/post-insert/">Log in</Link> : null}
        {banner.startsWith("Verify your ID") ? <Link href="/u/account/kyc/">Verify your ID</Link> : null}
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
                  <SelectField key={field.key} id={field.key} label={field.label} value={attrs[field.key] || ""} onChange={(value) => setAttrs((prev) => ({ ...prev, [field.key]: value }))}>
                    <option value="">Choose</option>
                    {field.options.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </SelectField>
                ) : field.options?.length ? (
                  <div key={field.key}>
                    <p className="t-small">{field.label}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {field.options.map((option) => (
                        <button key={option} type="button" className={`tk-choice ${attrs[field.key] === option ? "on" : ""}`} onClick={() => setAttrs((prev) => ({ ...prev, [field.key]: prev[field.key] === option ? "" : option }))}>
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <TextField key={field.key} id={field.key} label={field.label} value={attrs[field.key] || ""} onChange={(value) => setAttrs((prev) => ({ ...prev, [field.key]: value }))} />
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
            <p className="t-small">WhatsApp <Switch on={whatsapp} onClick={() => setWhatsapp((v) => !v)} /></p>
            <p className="t-small">Telegram <Switch on={telegramOn} onClick={() => setTelegramOn((v) => !v)} /></p>
            {telegramOn ? <TextField id="telegram" label="Telegram" value={telegram} onChange={setTelegram} /> : null}
          </Group>
          <p className={`t-small ${errors.terms ? "is-bad" : ""}`} style={errors.terms ? { outline: "1px solid var(--danger)", padding: 8 } : undefined}>
            <Switch on={terms} onClick={() => setTerms((v) => !v)} bad={Boolean(errors.terms)} />{" "}
            <strong>Terms, Conditions and Privacy Policy</strong> I have read the <Link href="/terms/">Terms and Conditions</Link> of use and <Link href="/privacy/">Privacy Policy</Link> and I hereby authorise the processing of my personal data for the purpose of providing this web service.
            {errors.terms ? <span className="tk-error" data-tk="field-error">{errors.terms}</span> : null}
          </p>
          <p className="t-small" style={errors.adult ? { outline: "1px solid var(--danger)", padding: 8 } : undefined}>
            <Switch on={adult} onClick={() => setAdult((v) => !v)} bad={Boolean(errors.adult)} /> I confirm that I am 18 or over, that the details in this ad are accurate, and that I own the rights to any photos I add.
            {errors.adult ? <span className="tk-error" data-tk="field-error">{errors.adult}</span> : null}
          </p>
          <p style={{ textAlign: "right", marginTop: 24 }}>
            <button type="button" className="tk-btn tk-btn-rose" data-tk="go-on" disabled={busy} onClick={goOn}>GO ON</button>
          </p>
        </>
      ) : null}
      {step === 2 ? (
        <>
          <div className="tk-form-panel">
            <h2 className="t-h3">Your photos</h2>
            <div className="tk-drop">
              <p>Drag photos here or</p>
              <label className="tk-btn tk-btn-outline-rose">
                ADD PHOTOS
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file || !draftId) {
                      setPhotoNote("Photo upload is coming soon. You can add photos after publishing.");
                      return;
                    }
                    const signed = await api("/api/media/sign", {
                      method: "POST",
                      body: JSON.stringify({ listingId: draftId, contentType: file.type, byteSize: file.size, kind: "image" }),
                    });
                    if (!signed.ok) setPhotoNote("Photo upload is coming soon. You can add photos after publishing.");
                    else setPhotoNote("Photo received. You can continue.");
                  }}
                />
              </label>
              <p className="t-small">Up to 6 photos, JPG, PNG or WebP, 8 MB each.</p>
            </div>
            {photoNote ? <p>{photoNote}</p> : <p className="t-small">Photo upload is coming soon. You can add photos after publishing.</p>}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
            <button type="button" className="tk-btn tk-btn-outline-rose" onClick={() => remember(draftId, 1)}>BACK</button>
            <button type="button" className="tk-btn tk-btn-rose" data-tk="go-on" onClick={() => remember(draftId, 3)}>GO ON</button>
          </div>
        </>
      ) : null}
      {step === 3 ? (
        <>
          <div className="tk-form-panel">
            <h2 className="t-h3">Preview</h2>
            <AdCard ad={preview as ListingDoc} />
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
            <button type="button" className="tk-btn tk-btn-outline-rose" onClick={() => setStep(2)}>BACK</button>{" "}
            <button type="button" className="tk-btn tk-btn-rose" data-tk="go-on" disabled={busy} onClick={publish}>PUBLISH</button>
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
        <h2 className="t-small">{title}</h2>
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

function Switch({ on, onClick, bad }: { on: boolean; onClick: () => void; bad?: boolean }) {
  return (
    <button type="button" className={`tk-switch ${on ? "on" : ""}`} aria-pressed={on} onClick={onClick} style={bad ? { outline: "1px solid var(--danger)" } : undefined}>
      <i />
      {on ? "YES" : "NO"}
    </button>
  );
}
