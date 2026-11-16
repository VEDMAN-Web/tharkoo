"use client";

import { useState } from "react";
import { saveHomeBannerForAdmin } from "@/app/admin/content-actions";
import { ImagePicker, type ImageRef } from "@/components/admin/ui/ImagePicker";
import { UPLOAD_RULES } from "@/components/upload/rules";

type Initial = { photo: string; photoWidth: number; photoHeight: number; photoPhone: string; photoAlt: string; textInImage: boolean };

const ref = (src: string, alt: string, width: number, height: number): ImageRef | null => (src ? { assetId: "", src, alt, width, height } : null);

/** H7.105: the Home banner. With "The headline is already in the picture" on, the banner shows the whole picture and draws no text over it. */
export function HomeBannerSection({ initial }: { initial: Initial }) {
  const [state, setState] = useState(initial);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(next: Initial) {
    setBusy(true);
    setMessage("");
    const result = await saveHomeBannerForAdmin(next);
    setBusy(false);
    if (!result.ok) return setMessage(result.message);
    setState({
      photo: result.hero.photo,
      photoWidth: result.hero.photoWidth,
      photoHeight: result.hero.photoHeight,
      photoPhone: result.hero.photoPhone,
      photoAlt: result.hero.photoAlt,
      textInImage: result.hero.textInImage,
    });
    setMessage("Saved.");
  }

  return (
    <section className="adm-card" aria-labelledby="home-banner-heading">
      <h2 id="home-banner-heading" className="t-h4">
        Home banner
      </h2>
      <ImagePicker
        label="Banner picture (computers)"
        value={ref(state.photo, state.photoAlt, state.photoWidth, state.photoHeight)}
        onChange={(next) => void save({ ...state, photo: next?.src ?? "", photoWidth: next?.width ?? 0, photoHeight: next?.height ?? 0 })}
        banner
        rule={UPLOAD_RULES.blockImage}
      />
      <ImagePicker
        label="Banner picture (phones, optional)"
        value={ref(state.photoPhone, state.photoAlt, 0, 0)}
        onChange={(next) => void save({ ...state, photoPhone: next?.src ?? "" })}
        banner
        rule={UPLOAD_RULES.blockImage}
      />
      <label className="adm-field">
        Alt text of the banner picture
        <input value={state.photoAlt} maxLength={200} onChange={(event) => setState({ ...state, photoAlt: event.target.value })} onBlur={() => void save(state)} />
      </label>
      <label className="adm-field adm-check">
        <input type="checkbox" checked={state.textInImage} disabled={busy} onChange={(event) => void save({ ...state, textInImage: event.target.checked })} />
        The headline is already in the picture
      </label>
      <p className="adm-field-help">On: the whole picture is shown with nothing cut and no text is drawn over it. The headline stays in the page for search engines and screen readers.</p>
      {message ? <p className="adm-field-help" role="status">{message}</p> : null}
    </section>
  );
}
