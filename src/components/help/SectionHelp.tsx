"use client";

import type { UiTextKey } from "@/lib/ui/text";
import { useT } from "./UiTextProvider";
import "./section-help.css";

/**
 * H7.8: "How to use this section". Closed by default; the text comes from the help texts in the UI-text store.
 * A native details and summary, so it works without script and is keyboard and screen-reader friendly.
 */
export function SectionHelp({ textKey, tone = "light" }: { textKey: UiTextKey; tone?: "light" | "dark" }) {
  const t = useT();
  return (
    <details className={tone === "dark" ? "sec-help sec-help-dark" : "sec-help"}>
      <summary>{t("help.label")}</summary>
      <p>{t(textKey)}</p>
    </details>
  );
}
