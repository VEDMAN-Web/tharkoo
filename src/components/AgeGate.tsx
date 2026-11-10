"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";

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
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (localStorage.getItem("nl-age") === "ok") {
        setOpen(false);
        window.dispatchEvent(new Event("tk-age-ok"));
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  if (!open) return null;
  return (
    <Dialog open title={title} align="center" onClose={() => {}}>
      <p className="t-overline">{brand}</p>
      <h2 className="t-h2 mt-2">{title}</h2>
      <p className="t-body mt-3 text-muted">{body}</p>
      <p className="t-small mt-3">
        <Link href="/terms/" className="text-gold">
          Terms
        </Link>
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          onClick={() => {
            localStorage.setItem("nl-age", "ok");
            window.dispatchEvent(new Event("tk-age-ok"));
            setOpen(false);
          }}
        >
          {yes}
        </Button>
        <Button variant="secondary" href="https://www.google.com">
          {no}
        </Button>
      </div>
    </Dialog>
  );
}
