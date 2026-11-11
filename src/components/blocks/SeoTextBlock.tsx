import { safeHtml } from "@/lib/sanitize";

export function SeoTextBlock({ title, body }: { title?: string; body?: string }) {
  return (
    <section className="tk-block tk-seo-text">
      {title ? <h2>{title}</h2> : null}
      <div className="tk-block-rich" dangerouslySetInnerHTML={{ __html: safeHtml(body ?? "") }} />
    </section>
  );
}
