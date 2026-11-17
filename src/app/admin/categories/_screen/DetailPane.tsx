"use client";

import Link from "next/link";
import { ArrowLeft, ExternalLink, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { undoAction } from "@/app/admin/undo-actions";
import { Badge, Button, ConfirmDialog, MoreMenu, Tabs, Toggle, useToast } from "@/components/admin/ui";
import { CategoryFieldsEditor, type EditorField } from "@/components/admin/category-fields/CategoryFieldsEditor";
import type { CategoryDetailView } from "@/server/categories/screen";
import { deleteCategoryAction, updateCategoryAction } from "../manage-actions";
import { saveCategoryPicturesAction } from "../picture-actions";
import { DetailsTab } from "./DetailsTab";
import { PicturesTab } from "./PicturesTab";
import { SubsTab } from "./SubsTab";
import { adsText, detailsOf, detailsProblems, KIND_MISSING, picturesOf, picturesProblems, TABS, type TabKey } from "./model";

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The right side: the category's name with its Visible on site switch, four tabs, and ONE save bar for Details and Pictures.
 * The drafts of both tabs live here, so moving between tabs keeps what was typed.
 */
export function DetailPane({
  detail,
  fieldCount,
  fields,
  tab,
  onTab,
  onDirty,
  listHref,
  urlFor,
}: {
  detail: CategoryDetailView;
  fieldCount: number;
  fields: EditorField[];
  tab: TabKey;
  onTab: (tab: TabKey) => void;
  onDirty: (dirty: boolean) => void;
  listHref: string;
  urlFor: (slug: string, tab: TabKey) => string;
}) {
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

  const detailsDirty = !same(details, baseDetails);
  const picturesDirty = !same(pictures, basePictures);
  const dirty = detailsDirty || picturesDirty;
  const detailErrors = { ...(tried ? detailsProblems(details) : {}), ...(details.kind ? {} : { kind: KIND_MISSING }) };
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
    const detailProblem = detailsProblems(details);
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
    let slug = detail.slug;
    if (detailsDirty) {
      const result = await updateCategoryAction(detail.id, {
        name: details.name,
        slug: details.slug.trim(),
        kind: details.kind,
        icon: details.icon,
        importMaxPhotos: details.importMaxPhotos.trim() === "" ? null : Number(details.importMaxPhotos),
        seoIntro: details.seoIntro,
        description: details.homeLine,
        enabled: details.enabled,
      });
      if (!result.ok) {
        setBusy(false);
        toast.show({ kind: "error", message: result.message });
        return;
      }
      slug = (result.data as { slug?: string } | undefined)?.slug ?? slug;
      setBaseDetails({ ...details, slug });
      setDetails((current) => ({ ...current, slug }));
    }
    let eventId = "";
    if (picturesDirty) {
      const answer = await saveCategoryPicturesAction({
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
    if (slug !== detail.slug) router.replace(urlFor(slug, tab));
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
    const result = await deleteCategoryAction(detail.id);
    if (!result.ok) {
      toast.show({ kind: "error", message: `${result.message}${result.message.includes("Hide") ? "" : " Hide it instead."}` });
      return;
    }
    toast.show({ kind: "success", message: `Removed ${detail.name}.` });
    onDirty(false);
    router.push(listHref);
    router.refresh();
  }

  const showBar = tab === "details" || tab === "pictures";
  const tabs = TABS.map((item) => ({ key: item.key, label: item.label, ...(item.key === "fields" ? { count: fieldCount } : item.key === "subs" ? { count: detail.subs.length } : {}) }));

  return (
    <section className="adm-card adm-cat-detail" aria-labelledby="cat-detail-title" data-tk="category-detail" data-slug={detail.slug}>
      <Link href={listHref} className="adm-cat-back" data-tk="cat-back" onClick={(event) => { if (dirty && !window.confirm("You have unsaved changes. Leave without saving?")) event.preventDefault(); }}>
        <ArrowLeft size={16} aria-hidden="true" /> All categories
      </Link>
      <header className="adm-cat-head">
        <div className="adm-cat-headtext">
          <h2 id="cat-detail-title">{baseDetails.name}</h2>
          <p>{`/${baseDetails.slug}/ · ${adsText(detail.adCount)}`}</p>
        </div>
        <div className="adm-cat-headtools">
          {details.enabled ? <Badge tone="ok">Shown</Badge> : <Badge>Hidden</Badge>}
          <Toggle checked={details.enabled} onChange={(enabled) => change(setDetails)({ ...details, enabled })} label="Visible on site" />
          <MoreMenu
            items={[
              { key: "view", label: "View on site", icon: ExternalLink, href: `/${baseDetails.slug}/` },
              { key: "remove", label: "Remove category", icon: Trash2, danger: true, onSelect: () => setRemoving(true) },
            ]}
          />
        </div>
      </header>
      <Tabs items={tabs} active={tab} onChange={(key) => onTab(key as TabKey)} label="Category sections" idPrefix="cat" />
      <div role="tabpanel" id={`cat-panel-${tab}`} aria-labelledby={`cat-${tab}`} className="adm-cat-body">
        {tab === "details" ? <DetailsTab draft={details} errors={detailErrors} canEdit onChange={change(setDetails)} /> : null}
        {tab === "pictures" ? <PicturesTab draft={pictures} errors={pictureErrors} onChange={change(setPictures)} /> : null}
        {tab === "fields" ? (
          <div className="adm-cat-fields" data-tk="fields-tab">
            <CategoryFieldsEditor key={detail.slug} slug={detail.slug} categoryName={detail.name} initial={fields} />
          </div>
        ) : null}
        {tab === "subs" ? <SubsTab key={detail.id} categoryId={detail.id} categoryName={detail.name} subs={detail.subs} /> : null}
      </div>
      {showBar ? (
        <div className="adm-k-savebar adm-cat-bar" role="region" aria-label="Save changes" data-tk="save-bar" data-dirty={dirty ? "yes" : "no"}>
          <span className={`adm-k-savedot${dirty ? " is-dirty" : ""}`} aria-hidden="true" />
          <span className="adm-k-savetext" aria-live="polite">
            <strong>{dirty ? "Unsaved changes" : saved ? "Saved. Live on the site in a few seconds." : "All changes saved"}</strong>{" "}
            {!dirty && saved ? (
              <span>
                <a href="/" target="_blank" rel="noopener" data-tk="view-home">Home page</a>
                {" · "}
                <a href={`/${baseDetails.slug}/`} target="_blank" rel="noopener" data-tk="view-category">View on site</a>
              </span>
            ) : null}
          </span>
          <span className="adm-k-sp" />
          <Button kind="quiet" disabled={!dirty || busy} onClick={discard}>Discard</Button>
          <Button kind="primary" busy={busy} disabled={!dirty} onClick={() => void save()}>Save</Button>
        </div>
      ) : null}
      <ConfirmDialog
        open={removing}
        title={`Remove ${detail.name}?`}
        body="A category that has ads cannot be removed: switch it to hidden instead. An empty category is removed with its sub-categories."
        confirmText={detail.slug}
        confirmLabel="Remove category"
        onConfirm={() => void remove()}
        onCancel={() => setRemoving(false)}
      />
    </section>
  );
}
