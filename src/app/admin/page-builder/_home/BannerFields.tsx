"use client";

import { MediaPicker, type MediaValue } from "@/components/admin/ui/MediaPicker";
import type { ImageRef } from "@/components/admin/ui/ImagePicker";
import { TextField } from "@/components/admin/ui/TextField";
import { Toggle } from "@/components/admin/ui/Toggle";
import type { BlockBase } from "@/server/models/layout";
import { H1_MAX, problemFor, type Problem, type Props } from "./model";

type Stored = { assetId?: string; src: string; alt: string; width?: number; height?: number };

const toRef = (image: Stored | null | undefined): ImageRef | null =>
  image?.src ? { assetId: image.assetId ?? "", src: image.src, alt: image.alt ?? "", width: image.width ?? 1, height: image.height ?? 1 } : null;

const toStored = (ref: ImageRef | null): Stored | null =>
  ref ? { ...(ref.assetId ? { assetId: ref.assetId } : {}), src: ref.src, alt: ref.alt, width: ref.width, height: ref.height } : null;

export function BannerFields({ block, problems, onChange }: { block: BlockBase; problems: readonly Problem[]; onChange: (patch: Props) => void }) {
  const props = block.props as Props;
  const focus = (props.focus as { x?: number; y?: number } | undefined) ?? {};
  const value: MediaValue = {
    image: toRef(props.imageDesktop as Stored | undefined),
    phone: toRef(props.imageMobile as Stored | undefined),
    focusX: focus.x ?? 50,
    focusY: focus.y ?? 25,
  };
  const inPicture = props.textInImage === true;
  return (
    <div className="adm-pb-fields" data-tk="banner-fields">
      <MediaPicker
        label="Picture for laptop"
        value={value}
        aspect="1920 / 700"
        error={{ image: problemFor(problems, block.id, "image"), alt: problemFor(problems, block.id, "alt") }}
        onChange={(next) =>
          onChange({
            imageDesktop: toStored(next.image),
            imageMobile: toStored(next.phone),
            focus: { x: next.focusX, y: next.focusY },
          })
        }
      />
      <Toggle checked={inPicture} onChange={(checked) => onChange({ textInImage: checked })} label="The headline is part of the picture" />
      <TextField
        label="Headline (H1, read by Google and screen readers)"
        required
        max={H1_MAX}
        value={String(props.h1 ?? "")}
        error={problemFor(problems, block.id, "h1")}
        help={inPicture ? "Not shown on screen because the words are in the picture. Keep it the same as the picture text." : "Shown over the picture."}
        onChange={(h1) => onChange({ h1 })}
      />
      <TextField label="Line under the headline (optional)" max={300} value={String(props.subline ?? "")} onChange={(subline) => onChange({ subline })} />
      <Toggle checked={props.showSearch !== false} onChange={(showSearch) => onChange({ showSearch })} label="Show search (city and category) under the banner" />
    </div>
  );
}
