"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Camera, Heart, TriangleAlert } from "lucide-react";
import { useT } from "@/components/help/UiTextProvider";
import { CityCombobox, type ComboCity } from "./CityCombobox";
import { InterestTags } from "./InterestTags";
import { POST_DESCRIPTION_MAX, POST_TITLE_MAX } from "@/lib/ui/post-form";
import "./details-step.css";

/** H21.2: Step 2, Ad details. The fields in the order of the design, the "Fix N things" summary, and the live preview that lights up the part being edited. */

export type SummaryItem = { id: string; text: string };
export type EditingPart = "" | "title" | "place" | "tags" | "name";

/** Which part of the preview a field belongs to. */
export function partOf(fieldId: string): EditingPart {
  if (fieldId === "title") return "title";
  if (fieldId === "city" || fieldId === "district") return "place";
  if (fieldId === "interest-input") return "tags";
  if (fieldId === "nickname") return "name";
  return "";
}

export function ErrorSummary({ items, tick }: { items: readonly SummaryItem[]; tick: number }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (tick > 0 && items.length) ref.current?.focus();
    // Focus moves to the summary only when Continue was pressed again (the tick changes), not while the list is edited.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
  if (!items.length) return null;
  return (
    <div ref={ref} className="tkd-sum" role="alert" tabIndex={-1} data-tk="error-summary">
      <b>
        <TriangleAlert size={18} aria-hidden="true" focusable="false" />
        {items.length === 1 ? t("post.v2.det.summaryOne") : t("post.v2.det.summary", { count: items.length })}
      </b>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              onClick={(event) => {
                event.preventDefault();
                const target = document.getElementById(item.id);
                target?.focus();
                target?.scrollIntoView({ block: "center" });
              }}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

type PreviewProps = {
  title: string;
  categoryName: string;
  placeName: string;
  interests: readonly string[];
  name: string;
  cover: string | null;
  editing: EditingPart;
};

export function DetailsPreview({ title, categoryName, placeName, interests, name, cover, editing }: PreviewProps) {
  const t = useT();
  const mark = (part: EditingPart) => (editing === part ? " editing" : "");
  return (
    <div className="tkd-pv" data-tk="details-preview" data-editing={editing || undefined}>
      <div className="tkd-pv-photo" style={cover ? { backgroundImage: `url("${cover}")` } : undefined}>
        {cover ? null : <Camera size={36} aria-hidden="true" focusable="false" />}
      </div>
      <div className="tkd-pv-body">
        <div className="tkd-pv-top">
          <div className={`tkd-pv-title${mark("title")}`}>
            {title.trim() || t("post.v2.det.previewTitle")}
            {editing === "title" ? <span className="tkd-pv-tag">{t("post.v2.det.editing")}</span> : null}
          </div>
          <Heart size={20} aria-hidden="true" focusable="false" />
        </div>
        <div className="tkd-pv-tags">
          {categoryName ? <span className="tkd-tag r">{categoryName}</span> : null}
          <span className={`tkd-tag v${mark("place")}`}>
            {placeName || t("post.v2.det.previewCity")}
            {editing === "place" ? <span className="tkd-pv-tag">{t("post.v2.det.editing")}</span> : null}
          </span>
          {interests.map((item) => (
            <span key={item} className={`tkd-tag v${mark("tags")}`}>{item}</span>
          ))}
        </div>
        <div className={`tkd-pv-by${mark("name")}`}>
          <span className="tkd-pv-av" aria-hidden="true">{(name.trim().charAt(0) || "?").toUpperCase()}</span>
          <span>
            {t("post.v2.det.postedBy")} <b>{name.trim() || t("post.v2.det.nameFallback")}</b>
          </span>
          {editing === "name" ? <span className="tkd-pv-tag">{t("post.v2.det.editing")}</span> : null}
        </div>
      </div>
    </div>
  );
}

type StepProps = {
  categoryName: string;
  /** Hidden while an ad that is already posted is edited (its category cannot change). */
  onChangeCategory?: () => void;
  title: string;
  titlePlaceholder: string;
  titleError?: string;
  onTitle: (value: string) => void;
  onTitleBlur: () => void;
  text: string;
  textPlaceholder: string;
  onText: (value: string) => void;
  onTextBlur: () => void;
  cities: readonly ComboCity[];
  cityId: string;
  cityError?: string;
  onCity: (city: ComboCity | null) => void;
  onCityBlur: () => void;
  districts: readonly { id: string; name: string }[];
  districtId: string;
  onDistrict: (id: string) => void;
  interests: string[];
  popular: readonly string[];
  onInterests: (next: string[]) => void;
  summary: readonly SummaryItem[];
  summaryTick: number;
  onEditing: (part: EditingPart) => void;
  /** The category's other fields, then the name and age fields that still live in this step. */
  children?: ReactNode;
};

export function DetailsStep(props: StepProps) {
  const t = useT();
  const { title, text } = props;
  return (
    <div
      className="tkd"
      data-tk="details-step"
      onFocusCapture={(event) => props.onEditing(partOf((event.target as HTMLElement).id))}
      onBlurCapture={() => props.onEditing("")}
    >
      <ErrorSummary items={props.summary} tick={props.summaryTick} />
      <div className="tkd-cat" data-tk="details-category">
        <span>{t("post.v2.det.category")}</span>
        <b>{props.categoryName}</b>
        {props.onChangeCategory ? (
          <button type="button" className="tkd-link" onClick={props.onChangeCategory}>{t("post.v2.det.change")}</button>
        ) : null}
      </div>

      <div className="tkd-fld">
        <label className="tkd-lbl" htmlFor="title">
          <span>{t("post.field.adTitle")} <span className="tkd-req" aria-hidden="true">*</span></span>
          <span className="tkd-count">{title.length} / {POST_TITLE_MAX}</span>
        </label>
        <input
          id="title"
          className={`tkd-inp${props.titleError ? " err" : ""}`}
          value={title}
          maxLength={POST_TITLE_MAX}
          placeholder={props.titlePlaceholder}
          aria-invalid={props.titleError ? true : undefined}
          onChange={(event) => props.onTitle(event.target.value.slice(0, POST_TITLE_MAX))}
          onBlur={props.onTitleBlur}
        />
        {props.titleError ? <p className="tkd-err" data-tk="field-error">{props.titleError}</p> : <p className="tkd-hint">{t("post.v2.det.titleHint")}</p>}
      </div>

      <div className="tkd-fld">
        <label className="tkd-lbl" htmlFor="text">
          <span>{t("post.field.description")} <span className="tkd-opt-note">{t("post.v2.det.optional")}</span></span>
          <span className="tkd-count">{text.length} / {POST_DESCRIPTION_MAX}</span>
        </label>
        <textarea
          id="text"
          className="tkd-inp"
          value={text}
          maxLength={POST_DESCRIPTION_MAX}
          placeholder={props.textPlaceholder}
          onChange={(event) => props.onText(event.target.value)}
          onBlur={props.onTextBlur}
        />
      </div>

      <div className="tkd-group">
        <p className="tkd-sec">{t("post.v2.det.where")}</p>
        <CityCombobox cities={props.cities} cityId={props.cityId} error={props.cityError} onPick={props.onCity} onBlur={props.onCityBlur} />
        <div className="tkd-fld">
          <label className="tkd-lbl" htmlFor="district">
            <span>{t("post.field.areaShort")} <span className="tkd-opt-note">{t("post.v2.det.optional")}</span></span>
          </label>
          <select id="district" className="tkd-inp tkd-select" value={props.districtId} disabled={!props.cityId} onChange={(event) => props.onDistrict(event.target.value)}>
            <option value="">{props.cityId ? t("post.select.area") : t("post.v2.det.areaFirst")}</option>
            {props.districts.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </div>
      </div>

      <InterestTags value={props.interests} popular={props.popular} onChange={props.onInterests} />

      {props.children}
    </div>
  );
}
