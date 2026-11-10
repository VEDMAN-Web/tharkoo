"use client";

import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { saveTagsForAdmin } from "../growth-actions";

export default function TagsAdminPage() {
  const [message, setMessage] = useState("");
  return (
    <AdminShell title="Tags">
      <p className="mb-4 t-small text-muted">One tag per line: slug, label. Tags with at least one ad can be indexed.</p>
      <form
        className="grid max-w-xl gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const result = await saveTagsForAdmin(String(form.get("tags") || ""));
          setMessage(result.ok ? `Saved ${result.count} tags` : result.message);
        }}
      >
        <textarea name="tags" rows={10} defaultValue={"individual, Individual\nin-person, In person\nonline, Online"} className="rounded border px-3 py-2" />
        <button type="submit" className="tk-btn tk-btn-primary w-fit">Save tags</button>
      </form>
      {message ? <p className="mt-3">{message}</p> : null}
    </AdminShell>
  );
}
