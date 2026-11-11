"use client";

import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { saveTagsForAdmin } from "@/app/admin/growth-actions";

export function TagsEditor({ initial }: { initial: string }) {
  const [message, setMessage] = useState("");
  const [value, setValue] = useState(initial);
  return (
    <AdminShell title="Tags">
      <p className="mb-4 t-small text-muted">One tag per line: slug, label. Saving replaces the list with exactly what is in this box, so it starts from the tags already stored.</p>
      <form
        className="grid max-w-xl gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const result = await saveTagsForAdmin(value);
          setMessage(result.ok ? `Saved ${result.count} tags` : result.message);
        }}
      >
        <textarea name="tags" rows={10} value={value} onChange={(event) => setValue(event.target.value)} className="rounded border px-3 py-2" />
        <button type="submit" className="tk-btn tk-btn-primary w-fit">Save tags</button>
      </form>
      {message ? <p className="mt-3">{message}</p> : null}
    </AdminShell>
  );
}
