import { safeHtml } from "@/lib/sanitize";

export function RichTextBlock({ title, body }: { title?: string; body?: string }) {
  return (
    <section className="tk-block">
      {title ? <h2>{title}</h2> : null}
      <div className="tk-block-rich" dangerouslySetInnerHTML={{ __html: safeHtml(body ?? "") }} />
    </section>
  );
}
