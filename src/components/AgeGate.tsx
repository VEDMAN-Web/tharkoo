"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";

export function AgeGate({ brand }: { brand: string; title: string; body: string; yes: string; no: string }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (localStorage.getItem("nl-age") === "ok") setOpen(false);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  if (!open) return null;
  return (
    <Dialog open sheet scrim={false} title="Please confirm your age" onClose={() => setOpen(false)}>
      <p className="t-overline">{brand}</p>
      <h2 className="t-h2 mt-2">Please confirm your age</h2>
      <p className="t-body mt-3 text-muted">Tharkoo is for people aged 18 and over. Confirm to continue.</p>
      <p className="t-small mt-3">
        <Link href="/cms/terms/" className="text-gold">
          Terms
        </Link>
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          onClick={() => {
            localStorage.setItem("nl-age", "ok");
            setOpen(false);
          }}
        >
          I am 18 or over
        </Button>
        <Button variant="secondary" href="https://www.google.com">
          Leave
        </Button>
      </div>
    </Dialog>
  );
}
