"use client";

import { useState } from "react";
import { saveLoginImageForAdmin } from "@/app/admin/content-actions";
import { ImagePicker, type ImageRef } from "@/components/admin/ui/ImagePicker";
import { UPLOAD_RULES, type UploadRule } from "@/components/upload/rules";

const LOGIN_IMAGE_RULE: UploadRule = {
  ...UPLOAD_RULES.blockImage,
  line: "Best size 800 x 1000, shown on the left of the log-in card.",
  details: ["Formats: JPG, PNG or WEBP.", "Up to 8 MB.", "Best size: 800 x 1000 px (tall)."],
};

export function LoginImageField({ initial }: { initial: string }) {
  const [src, setSrc] = useState(initial);
  const [message, setMessage] = useState("");

  async function change(next: ImageRef | null) {
    const value = next?.src ?? "";
    const result = await saveLoginImageForAdmin(value);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setSrc(value);
    setMessage("Saved.");
  }

  return (
    <div className="adm-stack">
      <ImagePicker
        label="Login image"
        value={src ? { assetId: "", src, alt: "Login image", width: 0, height: 0 } : null}
        onChange={change}
        rule={LOGIN_IMAGE_RULE}
      />
      {message ? <p className="adm-field-help">{message}</p> : null}
    </div>
  );
}
