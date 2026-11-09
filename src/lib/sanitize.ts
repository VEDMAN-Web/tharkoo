const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const ALLOWED_TAGS = new Set(["p", "br", "strong", "b", "em", "i", "u", "a", "ul", "ol", "li", "h2", "h3", "h4", "blockquote", "span"]);
const VOID_TAGS = new Set(["br"]);

export function safeCssColor(value: string | undefined) {
  if (!value) return "";
  return HEX.test(value.trim()) ? value.trim() : "";
}

export function safeSearch(q: string) {
  const cut = q.trim().slice(0, 64);
  return cut.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function safeHref(raw: string | undefined) {
  if (!raw) return "";
  const href = raw.trim();
  if (!href || href.length > 2048) return "";
  const lower = href.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("file:")
  ) {
    return "";
  }
  if (href.startsWith("/") && !href.startsWith("//") && !href.includes("\\")) {
    return href;
  }
  try {
    const url = new URL(href);
    if (url.protocol === "http:" || url.protocol === "https:") {
      url.username = "";
      url.password = "";
      return url.toString();
    }
  } catch {
    return "";
  }
  return "";
}

function escapeText(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(text: string) {
  return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function safeHtml(html: string) {
  if (!html) return "";
  let source = String(html).slice(0, 20_000);
  source = source.replace(/<!--[\s\S]*?-->/g, "");
  source = source.replace(
    /<\/?(script|style|iframe|object|embed|link|meta|form|input|textarea|button|svg|math|base|img)[\s\S]*?>/gi,
    "",
  );

  const out: string[] = [];
  const stack: string[] = [];
  const tagRe = /<(\/)?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(source))) {
    out.push(escapeText(source.slice(last, match.index)));
    last = match.index + match[0].length;
    const closing = Boolean(match[1]);
    const tag = match[2].toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) continue;
    if (closing) {
      const idx = stack.lastIndexOf(tag);
      if (idx >= 0) {
        while (stack.length > idx) {
          out.push(`</${stack.pop()}>`);
        }
      }
      continue;
    }
    if (VOID_TAGS.has(tag) || /\/\s*$/.test(match[3])) {
      out.push(`<${tag}>`);
      continue;
    }
    let attrs = "";
    if (tag === "a") {
      const hrefMatch = match[3].match(/href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const href = safeHref(hrefMatch ? hrefMatch[2] ?? hrefMatch[3] ?? hrefMatch[4] ?? "" : "");
      if (!href) continue;
      attrs = ` href="${escapeAttr(href)}" rel="nofollow noopener noreferrer"`;
    }
    stack.push(tag);
    out.push(`<${tag}${attrs}>`);
  }
  out.push(escapeText(source.slice(last)));
  while (stack.length) out.push(`</${stack.pop()}>`);
  return out.join("");
}

export function sanitizeRecord<T>(data: T): T {
  return JSON.parse(JSON.stringify(data), (key, value) => {
    if (typeof value !== "string") return value;
    if (key === "html") return safeHtml(value);
    if (key === "href" || key === "url" || key === "link") return safeHref(value);
    return value;
  }) as T;
}
