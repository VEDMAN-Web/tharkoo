"use client";

import { useEffect, useState } from "react";

export function AgeGate({
  brand,
  title,
  body,
  yes,
  no,
}: {
  brand: string;
  title: string;
  body: string;
  yes: string;
  no: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(localStorage.getItem("nl-age") !== "ok");
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#111]">
      <div className="w-[min(420px,calc(100%-32px))] bg-white p-8 text-center">
        <p className="logo-mark justify-center text-[28px]">
          <span className="dot" />
          {brand.toLowerCase()}
        </p>
        <h1 className="mt-6 text-[22px] font-normal">{title}</h1>
        <p className="mt-3 text-[13px] leading-5 text-[#555]">{body}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            className="bg-[var(--sk-blue)] py-3 text-sm font-bold text-white"
            onClick={() => {
              localStorage.setItem("nl-age", "ok");
              setOpen(false);
            }}
          >
            {yes}
          </button>
          <a className="border border-[#ccc] py-3 text-sm font-bold text-[#333] no-underline" href="https://www.google.com">
            {no}
          </a>
        </div>
        <p className="mt-4 text-[11px] text-[#888]">
          By entering you accept the <a href="/terms/">Terms of use</a>.
        </p>
      </div>
    </div>
  );
}
