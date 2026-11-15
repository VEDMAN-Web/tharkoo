import type { ShellConfig } from "@/server/site-links/shell-config-rules";

export function photoOf(shell: ShellConfig, scope: "category" | "city", slug: string) {
  const image = shell.media.images.find((item) => item.scope === scope && item.slug === slug);
  return image?.photo || image?.band || image?.bandPhone || "";
}
