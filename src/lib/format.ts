export function prettyPlace(slug?: string | null) {
  if (!slug) return "";
  return slug
    .split("-")
    .filter((part) => part && part !== "region")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function listingDateLabel(value?: string | Date | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "long", timeZone: "Asia/Kolkata" }).format(date).toUpperCase();
}

export function displayTitle(title?: string | null) {
  if (!title) return "";
  return title.replace(/^\d{6,}\s*-\s*/, "").trim();
}

export function timeAgo(value?: Date | string | null) {
  if (!value) return "";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Date.now() - then) / 1000;
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
