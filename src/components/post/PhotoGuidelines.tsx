"use client";

import { Check, X } from "lucide-react";
import { useT } from "@/components/help/UiTextProvider";
import { UPLOAD_RULES } from "@/components/upload/rules";
import { AD_MEDIA_MAX, VIDEO_MAX_BYTES, VIDEO_MAX_SECONDS } from "./mediaUpload";

/** H21.3: the "Photo guidelines" panel: three example tiles, a Do list, a Don't list, the file rules box and the closing line. The numbers come from the upload rules. */

const DO_KEYS = ["post.v2.ph.do1", "post.v2.ph.do2", "post.v2.ph.do3", "post.v2.ph.do4"] as const;
const DONT_KEYS = ["post.v2.ph.dont1", "post.v2.ph.dont2", "post.v2.ph.dont3", "post.v2.ph.dont4"] as const;

export function PhotoGuidelines({ where, limit = AD_MEDIA_MAX }: { where: "inline" | "side"; limit?: number }) {
  const t = useT();
  const mb = Math.round(VIDEO_MAX_BYTES / (1024 * 1024));
  return (
    <section className={`tkph-guide tkph-guide-${where}`} data-tk={`photo-guidelines-${where}`} aria-label={t("post.v2.ph.guideTitle")}>
      <h2 className="tkph-guide-title">{t("post.v2.ph.guideTitle")}</h2>
      <div className="tkph-ex" aria-hidden="true">
        <figure>
          <div className="tkph-ex-img good"><span className="tkph-ex-mark ok"><Check size={14} /></span></div>
          <figcaption>{t("post.v2.ph.ex1")}</figcaption>
        </figure>
        <figure>
          <div className="tkph-ex-img text"><span className="tkph-ex-mark no"><X size={14} /></span><span className="tkph-ex-text">{t("post.v2.ph.exSample")}</span></div>
          <figcaption>{t("post.v2.ph.ex2")}</figcaption>
        </figure>
        <figure>
          <div className="tkph-ex-img blur"><span className="tkph-ex-mark no"><X size={14} /></span></div>
          <figcaption>{t("post.v2.ph.ex3")}</figcaption>
        </figure>
      </div>
      <details className="tkph-all" data-tk="photo-all-rules">
        <summary>{t("post.v2.ph.allRules")}</summary>
      <p className="tkph-guide-sec ok">{t("post.v2.ph.do")}</p>
      <ul className="tkph-list">
        {DO_KEYS.map((key) => (
          <li key={key}><span className="tkph-bullet ok" aria-hidden="true"><Check size={14} /></span><span>{t(key)}</span></li>
        ))}
      </ul>
      <p className="tkph-guide-sec no">{t("post.v2.ph.dont")}</p>
      <ul className="tkph-list">
        {DONT_KEYS.map((key) => (
          <li key={key}><span className="tkph-bullet no" aria-hidden="true"><X size={14} /></span><span>{t(key)}</span></li>
        ))}
      </ul>
      <div className="tkph-rules">
        <b>{t("post.v2.ph.fileTitle")}</b>
        <span>{t("post.v2.ph.file1", { formats: UPLOAD_RULES.adPhotos.formats })}</span>
        <span>{t("post.v2.ph.file2", { seconds: VIDEO_MAX_SECONDS, mb })}</span>
        <span>{t("post.v2.ph.file3", { limit })}</span>
      </div>
      <p className="tkph-guide-foot">{t("post.v2.ph.guideFoot")}</p>
      </details>
    </section>
  );
}
