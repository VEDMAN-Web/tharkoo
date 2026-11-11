"use client";

import { useState } from "react";
import { Dialog } from "./Dialog";
import { Button } from "./Button";

export function StyleDialog() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4">
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Open dialog
      </Button>
      <Dialog open={open} title="Sample dialog" onClose={() => setOpen(false)}>
        <h2 className="t-h3">Sample dialog</h2>
        <p className="t-body mt-2 text-muted">Esc closes this layer and returns focus.</p>
        <Button type="button" className="mt-4" onClick={() => setOpen(false)}>
          Close
        </Button>
      </Dialog>
    </div>
  );
}
