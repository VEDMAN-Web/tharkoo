"use client";

import Link from "next/link";
import { ArrowLeft, ExternalLink, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { undoAction } from "@/app/admin/undo-actions";
import { PicturesTab } from "@/app/admin/_catalog/PicturesTab";
import { SaveBar } from "@/app/admin/_catalog/SaveBar";
import { adsText, picturesOf, picturesProblems } from "@/app/admin/_catalog/model";
import { ConfirmDialog, MoreMenu, Tabs, Toggle, useToast } from "@/components/admin/ui";
import { deletePlaceAction, updatePlaceAction } from "@/server/locations/admin-actions";
import type { PlaceDetailView } from "@/server/locations/screen";
import { savePlacePicturesAction } from "../picture-actions";
import { AreasTab } from "./AreasTab";
import { PlaceDetailsTab } from "./PlaceDetailsTab";
import { TABS, TYPE_NAME, detailsOf, detailsProblems, type TabKey } from "./model";

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The right side: the place with its Visible on site switch, its tabs (Details, Pictures, and Areas for a city), and ONE save bar
 * for Details and Pictures. The drafts of both tabs live here, so moving between tabs keeps what was typed.
 */
export function PlaceDetailPane({ detail, tab, onTab, onDirty, listHref }: { detail: PlaceDetailView; tab: TabKey; onTab: (tab: TabKey) => void; onDirty: (dirty: boolean) => void; listHref: string }) {
  const router = useRouter();
  const toast = useToast();
  const startDetails = useMemo(() => detailsOf(detail), [detail]);
  const startPictures = useMemo(() => picturesOf(detail.pictures), [detail]);
  const [baseDetails, setBaseDetails] = useState(startDetails);
  const [basePictures, setBasePictures] = useState(startPictures);
  const [details, setDetails] = useState(startDetails);
  const [pictures, setPictures] = useState(startPictures);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [removing, setRemoving] = useState(false);
  const isCity = detail.type === "city";
  const activeTab: TabKey = tab === "areas" && !isCity ? "details" : tab;

  const detailsDirty = !same(details, baseDetails);
  const picturesDirty = !same(pictures, basePictures);
  const dirty = detailsDirty || picturesDirty;
  const detailErrors = tried ? detailsProblems(details, detail.type) : {};
  const pictureErrors = tried ? picturesProblems(pictures) : {};

  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function change<T>(setter: (next: T) => void) {
    return (next: T) => {
      setSaved(false);
      setter(next);
    };
  }

  async function undoPictures(eventId: string) {
    const outcome = await undoAction(eventId);
    toast.show(outcome.ok ? { kind: "success", message: "Undone. The old pictures are back." } : { kind: "error", message: outcome.message });
    router.refresh();
  }

  async function save() {
    setTried(true);
    const detailProblem = detailsProblems(details, detail.type);
    const pictureProblem = picturesProblems(pictures);
    if (Object.keys(detailProblem).length > 0) {
      onTab("details");
      toast.show({ kind: "error", message: Object.values(detailProblem)[0] as string });
      return;
    }
    if (Object.keys(pictureProblem).length > 0) {
      onTab("pictures");
      toast.show({ kind: "error", message: Object.values(pictureProblem)[0] as string });
      return;
    }
    setBusy(true);
    if (detailsDirty) {
      const result = await updatePlaceAction(detail.id, { name: details.name, slug: details.slug.trim(), countryCode: details.countryCode, order: Number(details.order), enabled: details.enabled });
      if (!result.ok) {
        setBusy(false);
        toast.show({ kind: "error", message: result.message });
        return;
      }
      setBaseDetails(details);
    }
    let eventId = "";
    if (picturesDirty) {
      const answer = await savePlacePicturesAction({
        id: detail.id,
        photo: pictures.photo.image ? { assetId: pictures.photo.image.assetId, alt: pictures.photo.alt.trim(), focusX: pictures.photo.focusX, focusY: pictures.photo.focusY } : null,
        band: pictures.band.image ? { assetId: pictures.band.image.assetId, phoneAssetId: pictures.phone?.assetId ?? null, alt: pictures.band.alt.trim(), focusX: pictures.band.focusX, focusY: pictures.band.focusY } : null,
      });
      if (!answer.ok) {
        setBusy(false);
        toast.show({ kind: "error", message: answer.message });
        return;
      }
      eventId = answer.eventId;
      setBasePictures(pictures);
    }
    setBusy(false);
    setTried(false);
    setSaved(true);
    const message = "Saved. Live on the site in a few seconds.";
    toast.show(eventId ? { kind: "undo", message, onUndo: () => void undoPictures(eventId) } : { kind: "success", message });
    router.refresh();
  }

  function discard() {
    setDetails(baseDetails);
    setPictures(basePictures);
    setTried(false);
    setSaved(false);
  }

  async function remove() {
    setRemoving(false);
    const result = await deletePlaceAction(detail.id);
    if (!result.ok) {
      toast.show({ kind: "error", message: result.message });
      return;
    }
    toast.show({ kind: "success", message: `Removed ${detail.name}.` });
    onDirty(false);
    router.push(listHref);
    router.refresh();
  }

  const tabs = TABS.filter((item) => item.key !== "areas" || isCity).map((item) => ({ key: item.key, label: item.label, ...(item.key === "areas" ? { count: detail.areas.length } : {}) }));
  const links = [{ href: "/", label: "Home page", tk: "view-home" }, ...(detail.publicPath ? [{ href: detail.publicPath, label: "View on site", tk: "view-place" }] : [])];

  return (
    <section className="adm-card adm-cat-detail" aria-labelledby="place-detail-title" data-tk="place-detail" data-type={detail.type} data-slug={detail.slug}>
      <Link href={listHref} className="adm-cat-back" data-tk="place-back" onClick={(event) => { if (dirty && !window.confirm("You have unsaved changes. Leave without saving?")) event.preventDefault(); }}>
        <ArrowLeft size={16} aria-hidden="true" /> All places
      </Link>
      <header className="adm-cat-head">
        <div className="adm-cat-headtext">
          <h2 id="place-detail-title">{baseDetails.name}</h2>
          <p>{`${TYPE_NAME[detail.type]}${detail.where ? ` in ${detail.where}` : ""} · /${baseDetails.slug}/${detail.adCount === null ? "" : ` · ${adsText(detail.adCount)}`}`}</p>
        </div>
        <div className="adm-cat-headtools">
          <Toggle checked={details.enabled} onChange={(enabled) => change(setDetails)({ ...details, enabled })} label="Visible on site" />
          <MoreMenu
            items={[
              ...(detail.publicPath ? [{ key: "view", label: "View on site", icon: ExternalLink, href: detail.publicPath }] : []),
              { key: "remove", label: "Remove place", icon: Trash2, danger: true, onSelect: () => setRemoving(true) },
            ]}
          />
        </div>
      </header>
      <Tabs items={tabs} active={activeTab} onChange={(key) => onTab(key as TabKey)} label="Place sections" idPrefix="place" />
      <div role="tabpanel" id={`place-panel-${activeTab}`} aria-labelledby={`place-${activeTab}`} className="adm-cat-body">
        {activeTab === "details" ? <PlaceDetailsTab type={detail.type} where={detail.where} draft={details} errors={detailErrors} onChange={change(setDetails)} /> : null}
        {activeTab === "pictures" ? <PicturesTab draft={pictures} errors={pictureErrors} onChange={change(setPictures)} noun={detail.type} /> : null}
        {activeTab === "areas" ? <AreasTab key={detail.id} cityId={detail.id} cityName={detail.name} areas={detail.areas} /> : null}
      </div>
      {activeTab !== "areas" ? <SaveBar dirty={dirty} saved={saved} busy={busy} links={links} onDiscard={discard} onSave={() => void save()} /> : null}
      <ConfirmDialog
        open={removing}
        title={`Remove ${detail.name}?`}
        body="A place that has ads or places inside it cannot be removed: switch it to hidden instead."
        confirmText={detail.slug}
        confirmLabel="Remove place"
        onConfirm={() => void remove()}
        onCancel={() => setRemoving(false)}
      />
    </section>
  );
}
