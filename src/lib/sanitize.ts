const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function safeCssColor(value: string | undefined) {
  if (!value) return "";
  return HEX.test(value.trim()) ? value.trim() : "";
}

export function safeSearch(q: string) {
  const cut = q.trim().slice(0, 64);
  return cut.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function safeHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
    .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/data:/gi, "");
}
