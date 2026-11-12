import { safeHtml } from "@/lib/sanitize";

export function RichTextBlock({ title, body, as = "h2" }: { title?: string; body?: string; as?: "h1" | "h2" }) {
  const Heading = as;
  return (
    <section className="tk-block">
      {title ? <Heading>{title}</Heading> : null}
      <div className="tk-block-rich" dangerouslySetInnerHTML={{ __html: safeHtml(body ?? "") }} />
    </section>
  );
}
