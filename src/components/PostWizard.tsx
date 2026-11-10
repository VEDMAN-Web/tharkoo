"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, fieldErrors, friendlyError } from "@/lib/ui/api";
import { Button } from "./ui/Button";
import { Field, Input, Select, Textarea, Checkbox } from "./ui/Input";

type Cat = { _id: string; name: string; slug: string };
type City = { id: string; name: string };

const STEPS = ["Basics", "Details", "Photos"];

export function PostWizard() {
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState<Cat[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [cityId, setCityId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [telegram, setTelegram] = useState("");
  const [adult, setAdult] = useState(false);
  const [accurate, setAccurate] = useState(false);
  const [rights, setRights] = useState(false);
  const [draftId, setDraftId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    api<{ categories: Cat[] }>("/api/categories").then((res) => {
      if (res.ok) setCategories(res.data.categories || []);
    });
    api<{ locations: City[] }>("/api/locations?type=city").then((res) => {
      if (res.ok) setCities(res.data.locations || []);
    });
  }, []);

  function showError(error: { code?: string; message?: string; fields?: Record<string, string[]>; details?: Record<string, string[]> }) {
    const fields = fieldErrors(error);
    const extra = Object.values(fields).flat()[0];
    if (error.code === "UNAUTHORIZED") {
      setMessage("Sign in to save this draft.");
      return;
    }
    setMessage(extra ? `${friendlyError(error)} ${extra}` : friendlyError(error));
  }

  async function saveBasics() {
    if (!categoryId || title.trim().length < 5) {
      setMessage("Choose a category and a title of at least 5 characters.");
      return;
    }
    setBusy(true);
    setMessage("");
    const body = { categoryId, title: title.trim(), description: description.trim(), ...(cityId ? { cityId } : {}) };
    const res = draftId
      ? await api(`/api/listings/${draftId}`, { method: "PATCH", body: JSON.stringify({ stage: "basics", ...body }) })
      : await api<{ id: string }>("/api/listings", { method: "POST", body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) return showError(res.error);
    if (!draftId && "data" in res && res.data && typeof res.data === "object" && "id" in res.data) {
      setDraftId(String((res.data as { id: string }).id));
    }
    setStep(2);
  }

  async function saveDetails() {
    if (!draftId) return setMessage("Save the basics first.");
    if (!phone && !whatsapp && !telegram) return setMessage("Add at least one contact method.");
    setBusy(true);
    setMessage("");
    const res = await api(`/api/listings/${draftId}`, {
      method: "PATCH",
      body: JSON.stringify({
        stage: "details",
        contact: {
          ...(phone ? { phone } : {}),
          ...(whatsapp ? { whatsapp } : {}),
          ...(telegram ? { telegram } : {}),
        },
      }),
    });
    setBusy(false);
    if (!res.ok) return showError(res.error);
    setStep(3);
  }

  async function submit() {
    if (!draftId) return setMessage("Save a draft before submitting.");
    if (!adult || !accurate || !rights) return setMessage("Confirm the three statements to submit.");
    setBusy(true);
    setMessage("");
    const res = await api(`/api/listings/${draftId}/submit`, {
      method: "POST",
      body: JSON.stringify({ attestations: { adult: true, accurate: true, rights: true } }),
    });
    setBusy(false);
    if (!res.ok) {
      if (res.error.code === "VERIFICATION_REQUIRED") {
        setMessage("Verify your ID to publish.");
        return;
      }
      return showError(res.error);
    }
    setDone("Submitted for review.");
  }

  if (done) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <h1 className="t-h1">Draft submitted</h1>
        <p className="mt-3 t-body text-muted">{done}</p>
        <Button href="/u/account/ads/" className="mt-4">
          View your ads
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-xl px-4 py-8">
      <ol className="mb-6 flex gap-2 overflow-x-auto">
        {STEPS.map((label, index) => (
          <li key={label} className={`t-small ${step === index + 1 ? "text-gold" : "text-muted"}`}>
            {index + 1}/3 {label}
          </li>
        ))}
      </ol>
      <div aria-live="polite" className="mb-3 t-small text-gold">
        {message}{" "}
        {message.startsWith("Sign in") ? (
          <Link href="/u/login/?next=/u/post-insert/" className="underline">
            Log in
          </Link>
        ) : null}
        {message.startsWith("Verify your ID") ? (
          <Link href="/u/account/kyc/" className="underline">
            Verify your ID
          </Link>
        ) : null}
      </div>
      {step === 1 ? (
        <div className="grid gap-4">
          <h1 className="t-h1">Post an ad</h1>
          <Field id="category" label="Category">
            <Select id="category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>
              <option value="">Choose</option>
              {categories.map((cat) => (
                <option key={cat._id} value={String(cat._id)}>
                  {cat.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="city" label="City">
            <Select id="city" value={cityId} onChange={(event) => setCityId(event.target.value)}>
              <option value="">Choose</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="title" label="Title">
            <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} minLength={5} maxLength={140} required />
          </Field>
          <Field id="description" label="Description">
            <Textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} rows={6} />
          </Field>
          <Button type="button" onClick={saveBasics} loading={busy}>
            Save and continue
          </Button>
        </div>
      ) : null}
      {step === 2 ? (
        <div className="grid gap-4">
          <h1 className="t-h1">Contact</h1>
          <p className="t-small text-muted">These details stay hidden until someone chooses to reveal them.</p>
          <Field id="phone" label="Phone">
            <Input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" />
          </Field>
          <Field id="whatsapp" label="WhatsApp">
            <Input id="whatsapp" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} />
          </Field>
          <Field id="telegram" label="Telegram">
            <Input id="telegram" value={telegram} onChange={(event) => setTelegram(event.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button type="button" onClick={saveDetails} loading={busy}>
              Save and continue
            </Button>
          </div>
        </div>
      ) : null}
      {step === 3 ? (
        <div className="grid gap-4">
          <h1 className="t-h1">Photos</h1>
          <p className="t-body text-muted">Add photos after publishing: coming soon. You can submit the draft without a photo.</p>
          <Checkbox label="I am 18 or over" checked={adult} onChange={(event) => setAdult(event.target.checked)} />
          <Checkbox label="The details are accurate" checked={accurate} onChange={(event) => setAccurate(event.target.checked)} />
          <Checkbox label="I have the right to post this" checked={rights} onChange={(event) => setRights(event.target.checked)} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button type="button" variant="outline" onClick={() => setMessage(draftId ? "Draft saved." : "Save the earlier steps first.")}>
              Save draft
            </Button>
            <Button type="button" onClick={submit} loading={busy}>
              Submit for review
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
