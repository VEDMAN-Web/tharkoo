import type { ReactNode } from "react";
import Link from "next/link";
import { parseInline } from "@/lib/content/inline";
import { parseRich, type RichBody as RichBodyData } from "@/lib/content/rich";

export type RichMedia = Record<string, { src: string; alt?: string }>;

/** Inline marks as React nodes. Text is always a text node, so nothing typed can become markup. */
export function Inline({ text }: { text: string }): ReactNode {
  return parseInline(text).map((token, index) => {
    if (token.type === "bold") return <strong key={index}>{token.text}</strong>;
    if (token.type === "italic") return <em key={index}>{token.text}</em>;
    if (token.type === "link") {
      return token.external ? (
        <a key={index} href={token.href} rel="nofollow noopener" target="_blank">
          {token.text}
        </a>
      ) : (
        <Link key={index} href={token.href}>
          {token.text}
        </Link>
      );
    }
    return token.text;
  });
}

/**
 * Draws rich text (H8.28). A server component with no `dangerouslySetInnerHTML`: the body is validated data, and a body that
 * is not valid draws nothing. Pictures come from `media` (id to address) and are left out when the id is unknown.
 */
export function RichBody({ body, media = {} }: { body: unknown; media?: RichMedia }) {
  const parsed: RichBodyData | null = parseRich(body);
  if (!parsed || parsed.nodes.length === 0) return null;
  return (
    <div className="tk-rich" data-tk="rich-body">
      {parsed.nodes.map((node, index) => {
        if (node.t === "p") return <p key={index}><Inline text={node.text} /></p>;
        if (node.t === "quote") return <blockquote key={index}><Inline text={node.text} /></blockquote>;
        if (node.t === "h2") return <h2 key={index}>{node.text}</h2>;
        if (node.t === "h3") return <h3 key={index}>{node.text}</h3>;
        if (node.t === "ul") return <ul key={index}>{node.items.map((item, at) => <li key={at}><Inline text={item} /></li>)}</ul>;
        if (node.t === "ol") return <ol key={index}>{node.items.map((item, at) => <li key={at}><Inline text={item} /></li>)}</ol>;
        if (node.t === "img") {
          const picture = media[node.mediaId];
          if (!picture) return null;
          return (
            <figure key={index}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={picture.src} alt={node.alt} loading="lazy" />
              {node.caption ? <figcaption>{node.caption}</figcaption> : null}
            </figure>
          );
        }
        if (node.t === "faq") {
          return (
            <dl key={index} className="tk-rich-faq">
              {node.items.map((item, at) => (
                <div key={at}>
                  <dt>{item.q}</dt>
                  <dd><Inline text={item.a} /></dd>
                </div>
              ))}
            </dl>
          );
        }
        return (
          <p key={index} className="tk-rich-ads">
            <Link href={node.path}>{node.label || "See the ads"}</Link>
          </p>
        );
      })}
    </div>
  );
}
