"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarPlus, ExternalLink, History, Pause, Play } from "lucide-react";
import { Badge, Button, HistoryDrawer, PageHeader, ToastProvider, useToast, type BadgeTone, type HistoryEntry } from "@/components/admin/ui";
import { changedFields } from "@/components/admin/ui/kit-helpers";
import { bulkAdsAction, undoAdsBatchAction } from "../_actions/actions";
import type { AdField, AdHistory, StaffAd, StaffAdValues } from "@/server/listings/staff-edit";
import { restoreAdVersionAction, saveAdEditAction, undoAdEditAction } from "./edit-actions";
import "./ad-edit.css";

const TITLE_MAX = 70;
const DESCRIPTION_MAX = 4000;
const STATUS: Record<string, { tone: BadgeTone; text: string }> = {
  active: { tone: "ok", text: "Live" },
  pending: { tone: "info", text: "In review" },
  paused: { tone: "neutral", text: "Paused" },
  rejected: { tone: "bad", text: "Rejected" },
  expired: { tone: "neutral", text: "Expired" },
  archived: { tone: "neutral", text: "Archived" },
  removed: { tone: "bad", text: "Removed" },
};

function day(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "none";
}

function FieldInput({ field, value, onChange, id, error }: { field: AdField; value: unknown; onChange: (next: unknown) => void; id: string; error?: string }) {
  const text = typeof value === "string" || typeof value === "number" ? String(value) : "";
  const describedBy = error ? `${id}-e` : undefined;
  const label = (key: string) => field.optionLabels[key] ?? key;
  if (field.type === "boolean" || field.type === "bool") {
    return (
      <label className="adm-k-opt" htmlFor={id}>
        <input id={id} type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        <span><strong>{field.label}</strong></span>
      </label>
    );
  }
  if (field.type === "multiselect") {
    const picked = Array.isArray(value) ? (value as string[]) : [];
    return (
      <fieldset className="adm-ae-multi" aria-describedby={describedBy}>
        <legend className="adm-k-label">{field.label}</legend>
        {field.options.map((option) => (
          <label key={option} className="adm-k-opt">
            <input type="checkbox" checked={picked.includes(option)} onChange={(event) => onChange(event.target.checked ? [...picked, option] : picked.filter((item) => item !== option))} />
            <span>{label(option)}</span>
          </label>
        ))}
      </fieldset>
    );
  }
  const control =
    field.type === "select" ? (
      <select id={id} className="adm-k-input" value={text} aria-describedby={describedBy} aria-invalid={error ? true : undefined} onChange={(event) => onChange(event.target.value)}>
        <option value="">Not set</option>
        {field.options.map((option) => (
          <option key={option} value={option}>{label(option)}</option>
        ))}
      </select>
    ) : field.type === "textarea" ? (
      <textarea id={id} className="adm-k-input" rows={3} value={text} aria-describedby={describedBy} aria-invalid={error ? true : undefined} onChange={(event) => onChange(event.target.value)} />
    ) : (
      <input
        id={id}
        className="adm-k-input"
        type="text"
        inputMode={field.type === "number" || field.type === "range" ? "numeric" : undefined}
        value={text}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(field.type === "number" || field.type === "range" ? (event.target.value.replace(/[^\d.]/g, "") === "" ? "" : Number(event.target.value.replace(/[^\d.]/g, ""))) : event.target.value)}
      />
    );
  return (
    <>
      <label className="adm-k-label adm-k-lab" htmlFor={id}>
        <span>
          {field.label}
          {field.unit ? ` (${field.unit})` : ""}
          {field.required ? <span className="adm-k-req" aria-hidden="true"> *</span> : null}
        </span>
      </label>
      {control}
    </>
  );
}

function Screen({ ad, history }: { ad: StaffAd; history: AdHistory }) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState<StaffAdValues>(ad.values);
  const [saved, setSaved] = useState<StaffAdValues>(ad.values);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const look = STATUS[ad.status] ?? { tone: "neutral" as BadgeTone, text: ad.status };
  const dirty = changedFields(saved as unknown as Record<string, unknown>, values as unknown as Record<string, unknown>);
  const edit = ad.access.edit;

  function setValue<K extends keyof StaffAdValues>(key: K, value: StaffAdValues[K]) {
    setErrors((current) => ({ ...current, [key]: "" }));
    setValues((current) => ({ ...current, [key]: value }));
  }

  function setAttribute(key: string, value: unknown) {
    setErrors((current) => ({ ...current, [key]: "" }));
    setValues((current) => ({ ...current, attributes: { ...current.attributes, [key]: value } }));
  }

  async function undo(eventId: string) {
    const answer = await undoAdEditAction(eventId);
    toast.show({ kind: answer.ok ? "success" : "error", message: answer.message });
    router.refresh();
  }

  async function save() {
    const next: Record<string, string> = {};
    if (!values.title.trim()) next.title = "Enter a title.";
    if (!values.description.trim()) next.description = "Enter a description.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const answer = await saveAdEditAction({ id: ad.id, values }).catch(() => null);
    setBusy(false);
    if (!answer) {
      toast.show({ kind: "error", message: "Could not save. Nothing you did was lost. Try again." });
      return;
    }
    if (!answer.ok) {
      setErrors(Object.fromEntries(Object.entries(answer.fields ?? {}).map(([key, list]) => [key, list[0] ?? ""])));
      toast.show({ kind: "error", message: answer.message });
      return;
    }
    setSaved(values);
    toast.show(answer.changed ? { kind: "undo", message: `Saved ${answer.title}. The ad stays live.`, onUndo: () => void undo(answer.eventId) } : { kind: "success", message: "Nothing changed." });
    router.refresh();
  }

  async function restore(entry: HistoryEntry) {
    const answer = await restoreAdVersionAction({ id: ad.id, version: Number(entry.id) });
    setShowHistory(false);
    if (!answer.ok) toast.show({ kind: "error", message: answer.message });
    else toast.show({ kind: "undo", message: `Went back to ${entry.version}. A new version was made.`, onUndo: () => void undo(answer.eventId) });
    router.refresh();
  }

  async function status(action: "pause" | "resume" | "extend") {
    setBusy(true);
    const answer = await bulkAdsAction({ action, ids: [ad.id] });
    setBusy(false);
    if (!answer.ok) toast.show({ kind: "error", message: answer.message });
    else if (answer.changed === 0) toast.show({ kind: "error", message: `Nothing changed. ${answer.skipped[0]?.why ?? ""}`.trim() });
    else toast.show({ kind: "undo", message: action === "pause" ? "Paused." : action === "resume" ? "Back live." : "Extended by 30 days.", onUndo: () => void undoAdsBatchAction({ batchId: answer.batchId, eventIds: answer.eventIds }).then((done) => { toast.show({ kind: done.ok ? "success" : "error", message: done.message }); router.refresh(); }) });
    router.refresh();
  }

  const tabs = [
    { key: "versions", label: "Versions", entries: history.versions as HistoryEntry[] },
    { key: "decisions", label: "Decisions", entries: history.decisions as HistoryEntry[] },
    { key: "money", label: "Money", entries: history.money as HistoryEntry[] },
  ];

  return (
    <div className="adm-k adm-ae" data-tk="ad-edit">
      <PageHeader
        crumbs={[{ label: "All ads", href: "/admin/ads/" }, { label: ad.category || "Ad" }]}
        title={ad.values.title || "Untitled"}
        purpose={`${look.text} · posted by ${ad.seller.name}. Changes are saved as a new version you can undo for 30 days.`}
        secondary={[
          ...(ad.slug ? [{ key: "view", label: "View on site", icon: ExternalLink, href: `/ad/${ad.slug}/` }] : []),
          { key: "history", label: "History", icon: History, onClick: () => setShowHistory(true) },
        ]}
      />
      <div className="adm-ae-grid">
        <div className="adm-ae-main">
          <form className="adm-card adm-k-form" noValidate onSubmit={(event) => { event.preventDefault(); void save(); }} data-tk="ad-edit-form">
            <section className="adm-ae-sec" aria-labelledby="ae-basics">
              <div className="adm-ae-sec-head"><h2 id="ae-basics">Basics</h2><p>What buyers see first.</p></div>
              <div className="adm-ae-sec-body">
                <div className="adm-k-field">
                  <label className="adm-k-label adm-k-lab" htmlFor="ae-title"><span>Title<span className="adm-k-req" aria-hidden="true"> *</span></span><span className="adm-k-count">{values.title.length} / {TITLE_MAX}</span></label>
                  <input id="ae-title" className="adm-k-input" disabled={!edit} maxLength={TITLE_MAX} value={values.title} aria-invalid={errors.title ? true : undefined} aria-describedby={errors.title ? "ae-title-e" : undefined} onChange={(event) => setValue("title", event.target.value)} />
                  {errors.title ? <p className="adm-k-err" id="ae-title-e">{errors.title}</p> : null}
                </div>
                <div className="adm-ae-two">
                  <div className="adm-k-field">
                    <span className="adm-k-label">Category</span>
                    <p className="adm-ae-static">{[ad.category, ad.subcategory].filter(Boolean).join(" › ") || "none"}</p>
                  </div>
                  <div className="adm-k-field">
                    <label className="adm-k-label" htmlFor="ae-price">Price (rupees)</label>
                    <input id="ae-price" className="adm-k-input" disabled={!edit} type="text" inputMode="numeric" value={values.price === "" ? "" : String(values.price)} aria-invalid={errors.price ? true : undefined} aria-describedby="ae-price-h" onChange={(event) => setValue("price", event.target.value.replace(/[^\d]/g, "") === "" ? "" : Number(event.target.value.replace(/[^\d]/g, "")))} />
                    <p className="adm-k-help" id="ae-price-h">Leave empty to show Ask the seller.</p>
                    {errors.price ? <p className="adm-k-err">{errors.price}</p> : null}
                  </div>
                </div>
                <div className="adm-k-field">
                  <label className="adm-k-label adm-k-lab" htmlFor="ae-desc"><span>Description<span className="adm-k-req" aria-hidden="true"> *</span></span><span className="adm-k-count">{values.description.length} / {DESCRIPTION_MAX.toLocaleString("en-IN")}</span></label>
                  <textarea id="ae-desc" className="adm-k-input" rows={5} disabled={!edit} maxLength={DESCRIPTION_MAX} value={values.description} aria-invalid={errors.description ? true : undefined} aria-describedby={errors.description ? "ae-desc-e" : undefined} onChange={(event) => setValue("description", event.target.value)} />
                  {errors.description ? <p className="adm-k-err" id="ae-desc-e">{errors.description}</p> : null}
                </div>
              </div>
            </section>
            <section className="adm-ae-sec" aria-labelledby="ae-photos">
              <div className="adm-ae-sec-head"><h2 id="ae-photos">Photos</h2><p>The first photo is the cover. Changing photos comes in the next update.</p></div>
              <div className="adm-ae-sec-body">
                {ad.photos.length ? (
                  <ul className="adm-ae-photos">
                    {ad.photos.map((src, index) => (
                      <li key={src}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt={`Photo ${index + 1}`} width={120} height={90} />
                        {index === 0 ? <span className="adm-ae-cover">Cover</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="adm-ae-static">No photos on this ad.</p>
                )}
              </div>
            </section>
            <section className="adm-ae-sec" aria-labelledby="ae-location">
              <div className="adm-ae-sec-head"><h2 id="ae-location">Location</h2><p>Shown on the ad and used for city pages.</p></div>
              <div className="adm-ae-sec-body"><p className="adm-ae-static">{ad.place || "none"}</p></div>
            </section>
            {ad.fields.length ? (
              <section className="adm-ae-sec" aria-labelledby="ae-details">
                <div className="adm-ae-sec-head"><h2 id="ae-details">Details</h2><p>{`Fields for ${ad.category}. Change them in Categories and fields.`}</p></div>
                <div className="adm-ae-sec-body adm-ae-two">
                  {ad.fields.map((field) => (
                    <div key={field.key} className="adm-k-field">
                      <FieldInput field={field} id={`ae-f-${field.key}`} value={values.attributes[field.key]} error={errors[field.key]} onChange={(next) => setAttribute(field.key, next)} />
                      {errors[field.key] ? <p className="adm-k-err" id={`ae-f-${field.key}-e`}>{errors[field.key]}</p> : null}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </form>
          {edit ? (
            <div className="adm-k-savebar" role="region" aria-label="Save changes" data-tk="save-bar" data-dirty={dirty.length ? "yes" : "no"}>
              <span className={`adm-k-savedot${dirty.length ? " is-dirty" : ""}`} aria-hidden="true" />
              <span className="adm-k-savetext" aria-live="polite">{dirty.length ? <strong>{dirty.length === 1 ? "1 unsaved change" : `${dirty.length} unsaved changes`}</strong> : <span>All changes saved</span>}</span>
              <span className="adm-k-sp" />
              <Button kind="quiet" disabled={!dirty.length || busy} onClick={() => { setValues(saved); setErrors({}); }}>Discard</Button>
              <Button kind="primary" busy={busy} disabled={!dirty.length} onClick={() => void save()}>Save changes</Button>
            </div>
          ) : null}
        </div>
        <aside className="adm-ae-side" aria-label="About this ad">
          <section className="adm-card" aria-labelledby="ae-status">
            <h2 id="ae-status">Status</h2>
            <div className="adm-ae-badges"><Badge tone={look.tone}>{look.text}</Badge></div>
            <dl className="adm-ae-kv">
              <div><dt>Expires</dt><dd>{day(ad.expiresAt)}</dd></div>
              <div><dt>Posted</dt><dd>{day(ad.createdAt)}</dd></div>
            </dl>
            {edit ? (
              <div className="adm-ae-actions">
                <Button icon={CalendarPlus} busy={busy} onClick={() => void status("extend")}>Extend 30 days</Button>
                {ad.status === "paused" ? (
                  <Button icon={Play} busy={busy} onClick={() => void status("resume")}>Resume</Button>
                ) : (
                  <Button icon={Pause} busy={busy} disabled={ad.status !== "active"} onClick={() => void status("pause")}>Pause</Button>
                )}
              </div>
            ) : null}
          </section>
          <section className="adm-card" aria-labelledby="ae-money">
            <h2 id="ae-money">Money</h2>
            <dl className="adm-ae-kv">
              <div><dt>Posting fee</dt><dd>{ad.money.feeCredits > 0 ? `${ad.money.feeCredits} credits, paid` : "Free"}</dd></div>
              {ad.money.promotions.map((promo, index) => (
                <div key={index}><dt>Promotion</dt><dd>{promo.name}, {promo.status}{promo.until ? `, until ${day(promo.until)}` : ""}</dd></div>
              ))}
            </dl>
            <p className="adm-ae-note">Editing is free. A live ad stays live while you edit it.</p>
          </section>
          <section className="adm-card" aria-labelledby="ae-seller">
            <h2 id="ae-seller">Seller</h2>
            <p className="adm-ae-seller"><strong>{ad.seller.name}</strong><span>{ad.seller.liveAds} live {ad.seller.liveAds === 1 ? "ad" : "ads"} · ID check {ad.seller.idCheck.replaceAll("_", " ")}</span></p>
            <Button href={`/admin/users/?open=${ad.seller.id}`}>Open user</Button>
          </section>
        </aside>
      </div>
      <HistoryDrawer open={showHistory} title="Ad history" subtitle={ad.values.title} tabs={tabs} onClose={() => setShowHistory(false)} onRestore={(entry) => void restore(entry)} />
    </div>
  );
}

/** The ad edit page (H8.33): basics, details, a side column with status and money, and a history drawer with Restore. */
export function AdEditView(props: { ad: StaffAd; history: AdHistory }) {
  return (
    <ToastProvider>
      <Screen {...props} />
    </ToastProvider>
  );
}
