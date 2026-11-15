import type { ShellConfig } from "@/server/site-links/shell-config-rules";

export function photoOf(shell: ShellConfig, scope: "category" | "city", slug: string) {
  const key = slug.toLowerCase();
  const image = shell.media.images.find((item) => item.scope === scope && item.slug.toLowerCase() === key);
  if (scope === "city") return image?.band || image?.bandPhone || "";
  return image?.photo || image?.band || image?.bandPhone || "";
}
