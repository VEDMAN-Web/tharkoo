"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, RefreshCw } from "lucide-react";

type Props = { id: string; name: string; title: string; hint: string };

export function UploadBox({ id, name, title, hint }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState("");
  const [over, setOver] = useState(false);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function choose(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    setPreview(URL.createObjectURL(file));
  }

  return (
    <div className="up-drop-wrap">
      <label
        htmlFor={id}
        className={`up-dropbox ${over ? "is-over" : ""} ${preview ? "has-file" : ""}`}
        data-tk={`upload-${name}`}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          const file = event.dataTransfer.files[0];
          if (file && input.current) {
            const transfer = new DataTransfer();
            transfer.items.add(file);
            input.current.files = transfer.files;
            choose(file);
          }
        }}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={`Chosen photo: ${title}`} className="up-drop-thumb" />
        ) : (
          <span className="up-drop-icon" aria-hidden="true"><ImagePlus size={28} focusable="false" /></span>
        )}
        <span className="up-drop-text">
          <strong>{preview ? "Photo added" : title}</strong>
          <span>{preview ? "Tap to choose a different one" : hint}</span>
        </span>
        {preview ? <RefreshCw size={18} aria-hidden="true" focusable="false" /> : null}
        <input ref={input} id={id} name={name} type="file" accept="image/jpeg,image/png,image/webp" className="up-drop-input" onChange={(event) => choose(event.target.files?.[0])} />
      </label>
    </div>
  );
}
