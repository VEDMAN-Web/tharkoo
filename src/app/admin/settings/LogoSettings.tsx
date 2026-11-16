"use client";

import { useState } from "react";
import { ImagePicker, type ImageRef } from "@/components/admin/ui/ImagePicker";
import { UPLOAD_RULES, type UploadRule } from "@/components/upload/rules";
import { LOGO_DARK_DEFAULT, LOGO_LIGHT_DEFAULT } from "@/lib/brand";
import { saveLogoAction } from "./logo-actions";

const LOGO_RULE: UploadRule = {
  ...UPLOAD_RULES.blockImage,
  line: "A wide PNG with a transparent background, best 1224 x 386 px. It is shown 40 px high.",
  details: ["Formats: PNG, WEBP or JPG.", "Up to 8 MB.", "Best size: 1224 x 386 px, transparent background."],
};

/** Admin only. The logo for light backgrounds (header, footer) and for dark backgrounds. Empty keeps the logo that ships with the site. */
export function LogoSettings({ light, dark }: { light: string; dark: string }) {
  const [values, setValues] = useState({ light, dark });
  const [message, setMessage] = useState("");

  async function change(variant: "light" | "dark", next: ImageRef | null) {
    setMessage("");
    const result = await saveLogoAction(variant, next?.src ?? "");
    if (!result.ok) return setMessage(result.error);
    setValues({ light: result.light, dark: result.dark });
    setMessage("Saved. Every change is recorded in the audit log.");
  }

  const ref = (src: string, fallback: string): ImageRef | null => (src && src !== fallback ? { assetId: "", src, alt: "Tharkoo logo", width: 0, height: 0 } : null);
  return (
    <section className="mb-3" aria-labelledby="logo-settings-title">
      <h2 className="t-h3" id="logo-settings-title">Logo</h2>
      <p className="t-small text-muted">The Tharkoo logo in the header and footer. Remove a picture to go back to the logo that ships with the site.</p>
      <ImagePicker label="Logo (light backgrounds)" value={ref(values.light, LOGO_LIGHT_DEFAULT)} onChange={(next) => void change("light", next)} rule={LOGO_RULE} />
      <ImagePicker label="Logo (dark backgrounds)" value={ref(values.dark, LOGO_DARK_DEFAULT)} onChange={(next) => void change("dark", next)} rule={LOGO_RULE} />
      {message ? <p className="adm-field-help" role="status">{message}</p> : null}
    </section>
  );
}
