import { JsonLd } from "@/lib/jsonld";
import { safeHtml } from "@/lib/sanitize";

interface Item {
  q: string;
  a: string;
}

function plain(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Questions and answers. FAQPage structured data is written only because this block is visible on the page. */
export function FaqBlock({ title, items = [] }: { title?: string; items?: Item[] }) {
  if (!items.length) return null;
  return (
    <section className="tk-block tk-block-faq">
      {title ? <h2>{title}</h2> : null}
      {items.map((item) => (
        <details key={item.q}>
          <summary>{item.q}</summary>
          <div dangerouslySetInnerHTML={{ __html: safeHtml(item.a) }} />
        </details>
      ))}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: items.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: plain(safeHtml(item.a)) } })),
        }}
      />
    </section>
  );
}
