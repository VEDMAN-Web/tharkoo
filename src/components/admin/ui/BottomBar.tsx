import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import "@/styles/admin-kit.css";
import { bottomBarItems } from "./kit-helpers";

export type BottomBarItem = { key: string; label: string; href: string; icon: LucideIcon; count?: number; active?: boolean };

/** The phone bottom bar: at most 5 items (Today, Review, Support, Search, More) with live counts. Hidden from 768 px up. */
export function BottomBar({ items, label = "Admin shortcuts" }: { items: BottomBarItem[]; label?: string }) {
  return (
    <nav className="adm-k-bar" aria-label={label} data-tk="bottom-bar">
      {bottomBarItems(items).map((item) => {
        const Icon = item.icon;
        return (
          <Link key={item.key} href={item.href} aria-current={item.active ? "page" : undefined}>
            <Icon aria-hidden="true" focusable="false" />
            {item.label}
            {item.count && item.count > 0 ? <span className="adm-k-bar-count" aria-label={`${item.count} waiting`}>{item.count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
