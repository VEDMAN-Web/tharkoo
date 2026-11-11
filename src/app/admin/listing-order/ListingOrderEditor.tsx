"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DataTable, Notice, SaveBar, SortableList, Toggle, type Column, type SortableItem } from "@/components/admin/ui";
import type { loadListingOrder } from "@/server/ranking/admin";
import { addPinAction, previewAction, removePinAction, saveSettingsAction, setHiddenAction } from "./actions";

type State = Awaited<ReturnType<typeof loadListingOrder>>;
type Pin = State["pins"][number];
type Hidden = State["hidden"][number];
type PreviewRow = { position: number; id: string; title: string; slug: string; tier: string; verified: boolean; pinned: boolean };
type Option = { slug: string; name: string };

const TIER_LABEL: Record<string, string> = {
  star: "Star",
  "super-top": "Super top",
  flash: "Flash",
  top: "Top",
  highlight: "Highlight",
  new: "New",
  "auto-boost": "Auto boost",
  free: "Free (no paid promotion)",
};

function tierItems(order: readonly string[]): SortableItem[] {
  return order.map((code) => ({ id: code, label: TIER_LABEL[code] ?? code }));
}

function scopeOf(category: string, city: string) {
  if (!category) return "home";
  return `hub:${category}${city ? `/${city}` : ""}`;
}

function when(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : "any time";
}

export function ListingOrderEditor({ initial, categories, cities }: { initial: State; categories: Option[]; cities: Option[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tiers, setTiers] = useState<SortableItem[]>(tierItems(initial.settings.tierOrder));
  const [verifiedFirst, setVerifiedFirst] = useState(initial.settings.verifiedFirst);
  const [photoFirst, setPhotoFirst] = useState(initial.settings.photoFirst);
  const [dirty, setDirty] = useState(false);
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pinRef, setPinRef] = useState("");
  const [position, setPosition] = useState("1");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [hideRef, setHideRef] = useState("");

  const scope = scopeOf(category, city);
  const draft = () => ({ tierOrder: tiers.map((item) => item.id), verifiedFirst, photoFirst });

  /** Runs a server action, then shows its message or error and reloads the lists. */
  function run(task: () => Promise<{ ok: boolean; message?: string }>, done: string, after?: () => void) {
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await task();
      if (!result.ok) {
        setError(result.message ?? "Something went wrong");
        return;
      }
      setMessage(done);
      after?.();
      router.refresh();
    });
  }

  function preview() {
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await previewAction(scope, draft());
      if (!result.ok) setError(result.message);
      else {
        setRows(result.rows);
        setMessage(`Showing the first ${result.rows.length} ads in the new order. Nothing is saved yet.`);
      }
    });
  }

  const pinColumns: Column<Pin>[] = [
    { key: "position", label: "Position", sortable: true },
    { key: "title", label: "Ad", render: (pin) => <span>{pin.title}</span> },
    { key: "window", label: "Dates", value: (pin) => `${when(pin.startsAt)} to ${when(pin.endsAt)}` },
    { key: "state", label: "Status", value: (pin) => (pin.active ? "Active" : "Not active now") },
    {
      key: "remove",
      label: "Remove",
      value: () => "",
      render: (pin) => (
        <button type="button" className="adm-btn adm-btn-quiet" disabled={pending} aria-label={`Remove pin for ${pin.title}`} onClick={() => run(() => removePinAction(pin.id), "Pin removed")}>
          Remove
        </button>
      ),
    },
  ];
  const hiddenColumns: Column<Hidden>[] = [
    { key: "title", label: "Ad" },
    {
      key: "unhide",
      label: "Show again",
      value: () => "",
      render: (ad) => (
        <button type="button" className="adm-btn adm-btn-quiet" disabled={pending} aria-label={`Show ${ad.title} in feeds again`} onClick={() => run(() => setHiddenAction(ad.id, false), "Ad is back in the feeds")}>
          Show again
        </button>
      ),
    },
  ];
  const scopePins = initial.pins.filter((pin) => pin.scope === scope);

  return (
    <div className="adm-stack">
      {error ? <Notice kind="error">{error}</Notice> : null}
      {message ? <Notice>{message}</Notice> : null}

      <section className="adm-card adm-stack" aria-labelledby="lo-tiers">
        <h2 id="lo-tiers">Order of paid tiers</h2>
        <p className="adm-field-help">Top of the list is shown first. Ads with no paid promotion sit at the Free position.</p>
        <SortableList
          label="Paid tier order"
          items={tiers}
          onChange={(next) => {
            setTiers(next);
            setDirty(true);
          }}
        />
        <Toggle label="Verified ads first inside a tier" checked={verifiedFirst} onChange={(next) => { setVerifiedFirst(next); setDirty(true); }} />
        <Toggle label="Ads with photos first inside a tier" checked={photoFirst} onChange={(next) => { setPhotoFirst(next); setDirty(true); }} />
      </section>

      <section className="adm-card adm-stack" aria-labelledby="lo-page">
        <h2 id="lo-page">Page</h2>
        <p className="adm-field-help">Pins and the preview below are for this page.</p>
        <div className="adm-grid">
          <label className="adm-field">
            <span className="adm-field-label">Category</span>
            <select className="adm-input" value={category} onChange={(event) => { setCategory(event.target.value); setCity(""); setRows(null); }}>
              <option value="">Home page</option>
              {categories.map((item) => (
                <option key={item.slug} value={item.slug}>{item.name}</option>
              ))}
            </select>
          </label>
          <label className="adm-field">
            <span className="adm-field-label">City</span>
            <select className="adm-input" value={city} disabled={!category} onChange={(event) => { setCity(event.target.value); setRows(null); }}>
              <option value="">All cities</option>
              {cities.map((item) => (
                <option key={item.slug} value={item.slug}>{item.name}</option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <button type="button" className="adm-btn adm-btn-ghost" disabled={pending} onClick={preview}>
            Preview first 20 ads
          </button>
        </div>
        {rows ? (
          rows.length ? (
            <ol aria-label="Preview of the first 20 ads" className="adm-stack">
              {rows.map((row) => (
                <li key={row.id}>
                  <strong>{row.position}.</strong> {row.title}{" "}
                  <span className="adm-field-help">
                    {TIER_LABEL[row.tier === "supertop" ? "super-top" : row.tier] ?? row.tier}
                    {row.verified ? " · verified" : ""}
                    {row.pinned ? " · pinned" : ""}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p>No live ads on this page yet.</p>
          )
        ) : null}
      </section>

      <section className="adm-card adm-stack" aria-labelledby="lo-pins">
        <h2 id="lo-pins">Pinned ads on this page</h2>
        <p className="adm-field-help">A pinned ad moves to its position while its dates are running. It must be live and belong to this page.</p>
        <form
          className="adm-grid"
          onSubmit={(event) => {
            event.preventDefault();
            run(
              () => addPinAction({ scope, ref: pinRef, position: Number(position), startsAt: startsAt || null, endsAt: endsAt ? `${endsAt}T23:59:59.999Z` : null }),
              "Pin added",
              () => {
                setPinRef("");
                setStartsAt("");
                setEndsAt("");
              },
            );
          }}
        >
          <label className="adm-field">
            <span className="adm-field-label">Ad ID or ad link</span>
            <input className="adm-input" value={pinRef} onChange={(event) => setPinRef(event.target.value)} required />
          </label>
          <label className="adm-field">
            <span className="adm-field-label">Position</span>
            <input className="adm-input" type="number" min={1} max={50} value={position} onChange={(event) => setPosition(event.target.value)} required />
          </label>
          <label className="adm-field">
            <span className="adm-field-label">From (optional)</span>
            <input className="adm-input" type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
          </label>
          <label className="adm-field">
            <span className="adm-field-label">Until (optional)</span>
            <input className="adm-input" type="date" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
          </label>
          <div className="adm-field">
            <span className="adm-field-label">&nbsp;</span>
            <button type="submit" className="adm-btn" disabled={pending}>Add pin</button>
          </div>
        </form>
        <DataTable columns={pinColumns} rows={scopePins} rowKey={(pin) => pin.id} csvName="pins" emptyText="No pins on this page" />
      </section>

      <section className="adm-card adm-stack" aria-labelledby="lo-hidden">
        <h2 id="lo-hidden">Hidden ads</h2>
        <p className="adm-field-help">A hidden ad is left out of the home page and listing pages. Its own page still opens.</p>
        <form
          className="adm-grid"
          onSubmit={(event) => {
            event.preventDefault();
            run(() => setHiddenAction(hideRef, true), "Ad hidden from the feeds", () => setHideRef(""));
          }}
        >
          <label className="adm-field">
            <span className="adm-field-label">Ad ID or ad link</span>
            <input className="adm-input" value={hideRef} onChange={(event) => setHideRef(event.target.value)} required />
          </label>
          <div className="adm-field">
            <span className="adm-field-label">&nbsp;</span>
            <button type="submit" className="adm-btn" disabled={pending}>Hide ad</button>
          </div>
        </form>
        <DataTable columns={hiddenColumns} rows={initial.hidden} rowKey={(ad) => ad.id} csvName="hidden-ads" emptyText="No hidden ads" />
      </section>

      <SaveBar
        dirty={dirty}
        busy={pending}
        onPreview={preview}
        onPublish={() =>
          run(() => saveSettingsAction(draft()), "Tier order saved", () => setDirty(false))
        }
      />
    </div>
  );
}
