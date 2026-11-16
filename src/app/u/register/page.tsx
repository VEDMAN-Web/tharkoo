import { permanentRedirect } from "next/navigation";
import { loginPath } from "@/lib/urls";
import { getPaths } from "@/server/urls/service";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [paths, params] = await Promise.all([getPaths(), searchParams]);
  const next = typeof params.next === "string" && params.next ? `?next=${encodeURIComponent(params.next)}` : "";
  permanentRedirect(`${loginPath(paths)}${next}`);
}
