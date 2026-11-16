"use client";

import { useRouter } from "next/navigation";
import { AdCard } from "../ui/AdCard";
import { OwnerActions } from "../vendor/OwnerActions";
import { displayTitle } from "@/lib/format";
import type { ListingDoc } from "@/lib/models";
import { draftPath, ownAdStatus } from "@/lib/ui/ad-status";
import type { listOwnCards } from "@/server/listings/owner-cards";

/** H7.17: the user's own ads on the panel home, with the same status and actions as the seller panel. */
type OwnItem = Awaited<ReturnType<typeof listOwnCards>>["items"][number];

export function MyAdsList({ items }: { items: OwnItem[] }) {
  const router = useRouter();
  return (
    <ul className="up-cards-fill">
      {items.map((item) => {
        const status = ownAdStatus(item.status, item.expiresAt);
        const ad = (item.card ?? { slug: item.slug, title: displayTitle(item.title || ""), description: item.description ?? undefined, publicId: item.id, variant: "free" }) as ListingDoc;
        return (
          <li key={item.id}>
            <AdCard
              ad={ad}
              owner={{
                label: status.label,
                bg: status.bg,
                fg: status.fg,
                views: item.shown?.views ?? 0,
                clicks: item.shown?.clicks ?? 0,
                href: item.slug ? undefined : draftPath(item.id ?? ""),
                actions: <OwnerActions id={item.id ?? ""} title={ad.title} status={item.status ?? undefined} endsSoon={status.label === "Ending soon"} onDone={() => router.refresh()} />,
              }}
            />
          </li>
        );
      })}
    </ul>
  );
}
