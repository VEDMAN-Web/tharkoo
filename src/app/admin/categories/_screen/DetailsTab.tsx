"use client";

import { TextField } from "@/components/admin/ui";
import { CATEGORY_ICONS, categoryIconKey } from "@/lib/category-icons";
import { VIDEO_NEVER_FOR_PEOPLE, type KindView } from "@/lib/category-kinds";
import { KIND_HELP, MAX_HOME_LINE, MAX_INTRO, MAX_NAME, type Details, type DetailsErrors } from "./model";

/** The Details tab: two columns on a computer, one on a phone, every label on top, every help line under its field. */
export function DetailsTab({ draft, errors, kinds, peopleLocked, canEdit, onChange }: { draft: Details; errors: DetailsErrors; kinds: KindView[]; peopleLocked: boolean; canEdit: boolean; onChange: (next: Details) => void }) {
  const fallback = CATEGORY_ICONS.find((choice) => choice.key === (kinds.find((kind) => kind.key === draft.kind)?.icon || categoryIconKey("", draft.kind)));
  const set = (patch: Partial<Details>) => onChange({ ...draft, ...patch });
  return (
    <div className="adm-cat-form" data-tk="details-form">
      <TextField label="Name" required max={MAX_NAME} value={draft.name} error={errors.name} help="Shown to visitors on the Home page, menus and the category page." onChange={(name) => set({ name })} />
      <TextField label="Web address" required value={draft.slug} error={errors.slug} help="Lower case words joined by dashes. If you change it, the old address still leads here." onChange={(slug) => set({ slug })} />

      <div className="adm-cat-field" data-tk="kind-field">
        <label className="adm-k-label" htmlFor="cat-kind">
          Kind<span className="adm-k-req" aria-hidden="true"> *</span>
        </label>
        <select id="cat-kind" className="adm-k-input" disabled={!canEdit} value={draft.kind} aria-invalid={errors.kind ? true : undefined} aria-describedby="cat-kind-help" onChange={(event) => set({ kind: event.target.value })}>
          <option value="" disabled>
            Choose a kind
          </option>
          {kinds.map((option) => (
            <option key={option.key} value={option.key}>
              {option.name}
            </option>
          ))}
        </select>
        {errors.kind ? <p className="adm-k-err" role="alert" data-tk="kind-missing">{errors.kind}</p> : null}
        <p className="adm-k-help" id="cat-kind-help">{KIND_HELP}</p>
        {peopleLocked ? <p className="adm-k-help" data-tk="people-locked">This is a listing about people, so it always behaves as People, whatever kind is chosen. {VIDEO_NEVER_FOR_PEOPLE}</p> : null}
      </div>

      <div className="adm-cat-field">
        <label className="adm-k-label" htmlFor="cat-icon">Icon when there is no photo</label>
        <select id="cat-icon" className="adm-k-input" disabled={!canEdit} value={draft.icon} aria-describedby="cat-icon-help" onChange={(event) => set({ icon: event.target.value })}>
          <option value="">{fallback ? `Default for this kind (${fallback.label})` : "Default for this kind"}</option>
          {CATEGORY_ICONS.map((choice) => (
            <option key={choice.key} value={choice.key}>
              {choice.label}
            </option>
          ))}
        </select>
        <p className="adm-k-help" id="cat-icon-help">Shown in a pink tile on the Home page while there is no Home page tile picture.</p>
      </div>

      <div className="adm-cat-field">
        <label className="adm-k-label" htmlFor="cat-max-photos">Max photos for admin posts and imports</label>
        <input
          id="cat-max-photos"
          className="adm-k-input"
          type="number"
          inputMode="numeric"
          min={1}
          max={30}
          placeholder="10"
          disabled={!canEdit}
          value={draft.importMaxPhotos}
          aria-invalid={errors.importMaxPhotos ? true : undefined}
          aria-describedby="cat-max-photos-help"
          onChange={(event) => set({ importMaxPhotos: event.target.value })}
        />
        {errors.importMaxPhotos ? <p className="adm-k-err" role="alert">{errors.importMaxPhotos}</p> : null}
        <p className="adm-k-help" id="cat-max-photos-help">A number from 1 to 30 for ads made by staff or imported. Blank means 10.</p>
      </div>

      <div className="adm-cat-wide">
        <TextField label="SEO intro" multiline max={MAX_INTRO} value={draft.seoIntro} error={errors.seoIntro} help="A short paragraph at the top of this category's page for search engines and visitors." onChange={(seoIntro) => set({ seoIntro })} />
      </div>

      <h3 className="adm-cat-group">Home page</h3>
      <div className="adm-cat-wide">
        <TextField label="Line under the name on the Home tile" max={MAX_HOME_LINE} value={draft.homeLine} error={errors.homeLine} help="One short line, for example what people find here. Empty shows a standard line." onChange={(homeLine) => set({ homeLine })} />
      </div>
    </div>
  );
}
