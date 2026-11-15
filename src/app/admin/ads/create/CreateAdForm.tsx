"use client";

import Link from "next/link";
import { useState } from "react";
import { Notice } from "@/components/admin/ui";
import type { AdFormOptions, AdFormPlace } from "@/server/listings/admin-form";
import { AdAttributeFields, attributePayload, type AttributeValues } from "./AdAttributeFields";
import { AdMediaPicker } from "./AdMediaPicker";
import { AdPlacePicker, NO_PLACE, type PlaceChoice } from "./AdPlacePicker";
import { createAdAction } from "./actions";
import { useAdMedia } from "./useAdMedia";

const DEFAULT_PHOTO_LIMIT = 10;
/** H6.18: photos and videos share one limit for every ad. The server checks the same number. */
const AD_MEDIA_MAX = 10;
const DESCRIPTION_MIN = 20;

interface FormState {
  ownerMode: "self" | "other";
  ownerEmail: string;
  categoryId: string;
  subcategoryId: string;
  place: PlaceChoice;
  title: string;
  description: string;
  price: string;
  attributes: AttributeValues;
  publishNow: boolean;
}

const EMPTY: FormState = {
  ownerMode: "self",
  ownerEmail: "",
  categoryId: "",
  subcategoryId: "",
  place: NO_PLACE,
  title: "",
  description: "",
  price: "",
  attributes: {},
  publishNow: false,
};

type Done = { id: string; status: "pending" | "active" } | null;

const section = { display: "grid", gap: 12, minWidth: 0 } as const;
const input = { className: "adm-input", style: { maxWidth: "100%" } } as const;

function Heading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="adm-field-label" style={{ fontSize: 16 }}>
      {children}
    </h2>
  );
}

/** Switching the account clears the photos and videos (they belong to one account). Typing an email does not. */
function Owner({ form, onMode, onEmail }: { form: FormState; onMode: (next: Partial<FormState>) => void; onEmail: (next: Partial<FormState>) => void }) {
  return (
    <section className="adm-card" aria-labelledby="ad-owner-h" style={section}>
      <Heading id="ad-owner-h">1. Who is the ad for</Heading>
      <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input type="radio" name="owner" checked={form.ownerMode === "self"} onChange={() => onMode({ ownerMode: "self", ownerEmail: "" })} />
        <span>My staff account</span>
      </label>
      <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input type="radio" name="owner" checked={form.ownerMode === "other"} onChange={() => onMode({ ownerMode: "other" })} />
        <span>Another account, by email</span>
      </label>
      {form.ownerMode === "other" ? (
        <label style={{ display: "grid", gap: 4 }}>
          <span className="adm-field-label">Account email</span>
          <input {...input} type="email" value={form.ownerEmail} onChange={(event) => onEmail({ ownerEmail: event.target.value })} autoComplete="off" />
          <span className="adm-field-help">The account must already exist. Remove photos before you change the account.</span>
        </label>
      ) : null}
    </section>
  );
}

function Details({ form, options, onChange }: { form: FormState; options: AdFormOptions; onChange: (next: Partial<FormState>) => void }) {
  const category = options.categories.find((row) => row.id === form.categoryId);
  return (
    <section className="adm-card" aria-labelledby="ad-details-h" style={section}>
      <Heading id="ad-details-h">3. Category and details</Heading>
      <label style={{ display: "grid", gap: 4 }}>
        <span className="adm-field-label">Category *</span>
        <select {...input} value={form.categoryId} onChange={(event) => onChange({ categoryId: event.target.value, subcategoryId: "", attributes: {} })}>
          <option value="">Choose a category</option>
          {options.categories.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
      </label>
      {category && category.subcategories.length ? (
        <label style={{ display: "grid", gap: 4 }}>
          <span className="adm-field-label">Sub-category *</span>
          <select {...input} value={form.subcategoryId} onChange={(event) => onChange({ subcategoryId: event.target.value })}>
            <option value="">Choose a sub-category</option>
            {category.subcategories.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label style={{ display: "grid", gap: 4 }}>
        <span className="adm-field-label">Title *</span>
        <input {...input} value={form.title} maxLength={140} onChange={(event) => onChange({ title: event.target.value })} />
        <span className="adm-field-help">At least 5 letters or numbers.</span>
      </label>
      <label style={{ display: "grid", gap: 4 }}>
        <span className="adm-field-label">Description *</span>
        <textarea {...input} rows={6} maxLength={5000} value={form.description} onChange={(event) => onChange({ description: event.target.value })} />
        <span className="adm-field-help">At least {DESCRIPTION_MIN} characters. {form.description.trim().length} now.</span>
      </label>
      <label style={{ display: "grid", gap: 4 }}>
        <span className="adm-field-label">Price in rupees (optional)</span>
        <input {...input} type="number" min={0} inputMode="numeric" value={form.price} onChange={(event) => onChange({ price: event.target.value })} />
      </label>
      {category ? <AdAttributeFields fields={category.fields} values={form.attributes} onChange={(key, value) => onChange({ attributes: { ...form.attributes, [key]: value } })} /> : null}
    </section>
  );
}

/** Builds the request body from the form. Blank optional values are left out. */
function requestBody(form: FormState, fields: AdFormOptions["categories"][number]["fields"], photoIds: string[], videoIds: string[]) {
  const price = form.price.trim();
  return {
    ownerEmail: form.ownerMode === "other" ? form.ownerEmail.trim() : "",
    categoryId: form.categoryId,
    subcategoryId: form.subcategoryId,
    cityId: form.place.cityId,
    districtId: form.place.districtId,
    title: form.title,
    description: form.description,
    price: price === "" ? null : Number(price),
    attributes: attributePayload(fields, form.attributes),
    photoIds,
    videoIds,
    status: form.publishNow ? ("active" as const) : ("pending" as const),
  };
}

export function CreateAdForm({ options, canPublish }: { options: AdFormOptions; canPublish: boolean }) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [places, setPlaces] = useState<AdFormPlace[]>(options.places);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done>(null);
  const ownerKey = form.ownerMode === "other" ? form.ownerEmail.trim() : "";
  const category = options.categories.find((row) => row.id === form.categoryId);
  const photoLimit = category?.photoLimit ?? DEFAULT_PHOTO_LIMIT;
  const photos = useAdMedia("image", photoLimit, ownerKey);
  const videos = useAdMedia("video", AD_MEDIA_MAX, ownerKey);
  // Each picker takes only what is left after the other kind.
  // H7.8: a refused file does not count toward the limit.
  const mediaRoom = AD_MEDIA_MAX - photos.counted - videos.counted;
  const mediaTotal = `Photos and videos together: ${photos.counted + videos.counted} of ${AD_MEDIA_MAX}`;

  function change(next: Partial<FormState>) {
    setForm((current) => ({ ...current, ...next }));
    setDone(null);
  }

  function changeOwner(next: Partial<FormState>) {
    photos.reset();
    videos.reset();
    change(next);
  }

  async function submit() {
    setError("");
    if (photos.busy || videos.busy) return setError("Wait for the photos and videos to finish uploading.");
    if (photos.failed || videos.failed) return setError("Remove the photos or videos that failed, then try again.");
    if (!category) return setError("Choose a category.");
    setBusy(true);
    const result = await createAdAction(requestBody(form, category.fields, photos.readyIds, videos.readyIds));
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setDone({ id: result.id, status: result.status });
  }

  function addPlace(place: AdFormPlace) {
    setPlaces((current) => [...current, place]);
  }

  function startAnother() {
    photos.reset();
    videos.reset();
    setForm(EMPTY);
    setDone(null);
    setError("");
  }

  if (done) {
    return (
      <div className="adm-stack">
        <Notice kind="info">
          {done.status === "active" ? "The ad is live now." : "The ad is in the moderation queue."}
        </Notice>
        <p className="t-small">
          <Link className="adm-link" href="/admin/moderation/">Open the moderation queue</Link>
        </p>
        <button type="button" className="adm-btn" onClick={startAnother}>Create another ad</button>
      </div>
    );
  }

  return (
    <div className="adm-stack" style={{ minWidth: 0 }}>
      <p className="mb-3 t-small text-muted">Make an ad for an account. It uses the same rules as the post-ad form. Nothing is saved until you press Create ad.</p>
      <Owner form={form} onMode={changeOwner} onEmail={change} />
      <section className="adm-card" aria-labelledby="ad-place-h" style={section}>
        <Heading id="ad-place-h">2. Location</Heading>
        <AdPlacePicker
          places={places}
          value={form.place}
          onChange={(place) => change({ place })}
          onPlaceAdded={addPlace}
        />
      </section>
      <Details form={form} options={options} onChange={change} />
      <section className="adm-card" aria-labelledby="ad-photos-h" style={section}>
        <Heading id="ad-photos-h">4. Photos</Heading>
        <AdMediaPicker
          kind="image"
          items={photos.items}
          limit={photoLimit}
          note={photos.note}
          disabled={!category || mediaRoom <= 0}
          totalNote={mediaTotal}
          onFiles={(files) => void photos.add(files.slice(0, Math.max(0, mediaRoom)))}
          onRemove={photos.remove}
          onMove={photos.move}
          onCover={photos.makeCover}
        />
      </section>
      <section className="adm-card" aria-labelledby="ad-videos-h" style={section}>
        <Heading id="ad-videos-h">5. Videos (optional)</Heading>
        <AdMediaPicker kind="video" items={videos.items} limit={AD_MEDIA_MAX} note={videos.note} disabled={mediaRoom <= 0} totalNote={mediaTotal} onFiles={(files) => void videos.add(files.slice(0, Math.max(0, mediaRoom)))} onRemove={videos.remove} onMove={videos.move} />
      </section>
      <section className="adm-card" aria-labelledby="ad-publish-h" style={section}>
        <Heading id="ad-publish-h">6. Publish</Heading>
        {canPublish ? (
          <>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="radio" name="publish" checked={!form.publishNow} onChange={() => change({ publishNow: false })} />
              <span>Send to moderation (default)</span>
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="radio" name="publish" checked={form.publishNow} onChange={() => change({ publishNow: true })} />
              <span>Publish now</span>
            </label>
          </>
        ) : (
          <p className="adm-field-help">This ad goes to the moderation queue. Only a superadmin can publish at once.</p>
        )}
        <p className="adm-field-help">The ad lasts 72 hours, like any other ad.</p>
        {error ? <Notice kind="error">{error}</Notice> : null}
        <div>
          <button type="button" className="adm-btn" disabled={busy || !category} onClick={() => void submit()}>
            {busy ? "Creating..." : "Create ad"}
          </button>
        </div>
      </section>
    </div>
  );
}
