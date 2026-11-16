import type { Metadata } from "next";
import { canonical } from "@/lib/seo";

export function withPagination(meta: Metadata, path: string, page: number, pages: number): Metadata {
  const href = (n: number) => canonical(n <= 1 ? path : `${path}?page=${n}`);
  const pagination = {
    ...(page > 1 && page <= pages ? { previous: href(page - 1) } : {}),
    ...(page < pages ? { next: href(page + 1) } : {}),
  };
  return Object.keys(pagination).length ? { ...meta, pagination } : meta;
}
