"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchX } from "lucide-react";
import { Badge, Button, FilterBar, PageHeader, ServerTable, Tabs, ToastProvider, type TableColumn } from "@/components/admin/ui";
import type { UserAccess } from "../_actions/UserActions";
import type { UserDetail, UserList, UserRow, UserTab } from "@/server/admin/users";
import { lastSeenLabel, dateLabel, statusLook, subLine } from "./format";
import { UserDrawer } from "./UserDrawer";
import "./users.css";

const TAB_LABELS: Record<UserTab, string> = { all: "All", sellers: "Sellers", id: "ID waiting", banned: "Banned", staff: "Staff" };
const SEARCH_DEBOUNCE_MS = 350;

/** The Users screen (H8.8, read only): tabs, search, the table and the drawer. Everything you pick lives in the address. */
export function UsersView({ list, detail, access }: { list: UserList; detail: UserDetail | null; access: UserAccess }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [search, setSearch] = useState(list.query.q);
  const sentSearch = useRef(list.query.q);

  function go(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    const text = next.toString();
    router.push(`${pathname}${text ? `?${text}` : ""}`, { scroll: false });
  }

  useEffect(() => {
    if (search.trim() === sentSearch.current) return;
    const id = window.setTimeout(() => {
      sentSearch.current = search.trim();
      go({ q: search.trim() || null, page: null, open: null });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const now = new Date();
  const columns: TableColumn<UserRow>[] = [
    {
      key: "user",
      header: "User",
      primary: true,
      cell: (row) => (
        <>
          <strong>{row.name}</strong>
          <small>{subLine(row)}</small>
        </>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => {
        const look = statusLook(row);
        return <Badge tone={look.tone}>{look.text}</Badge>;
      },
    },
    { key: "ads", header: "Ads", nowrap: true, cell: (row) => `${row.ads} ${row.ads === 1 ? "ad" : "ads"}` },
    { key: "city", header: "City", hideOnPhone: true, cell: (row) => row.city ?? "unknown" },
    { key: "seen", header: "Last seen", nowrap: true, cell: (row) => <span title={dateLabel(row.lastSeen, now)}>{lastSeenLabel(row.lastSeen, now)}</span> },
  ];

  const searching = list.query.q !== "";
  return (
    <ToastProvider>
    <div className="adm-k" data-tk="users-screen">
      <PageHeader
        crumbs={[{ label: "Ads & people" }]}
        title="Users"
        purpose="Everyone with an account. Open a row to see their ads, tickets and credits."
      />
      <div className="adm-card adm-u-flat">
        <Tabs
          idPrefix="users"
          label="Users"
          active={list.query.tab}
          items={(Object.keys(TAB_LABELS) as UserTab[]).map((key) => ({ key, label: TAB_LABELS[key], count: list.counts[key] }))}
          onChange={(key) => go({ tab: key === "all" ? null : key, page: null, open: null })}
        />
        <div role="tabpanel" id={`users-panel-${list.query.tab}`} aria-labelledby={`users-${list.query.tab}`}>
          <FilterBar
            search={search}
            onSearch={setSearch}
            searchLabel="Search users"
            placeholder="Name, email, phone or ad ID"
            chips={[]}
            onRemoveChip={() => undefined}
          />
          <ServerTable
            label={`${TAB_LABELS[list.query.tab]} users`}
            columns={columns}
            rows={list.rows}
            rowId={(row) => row.id}
            rowLabel={(row) => row.name}
            total={list.total}
            page={list.query.page}
            pageSize={list.query.pageSize}
            onPage={(page) => go({ page: page === 1 ? null : String(page), open: null })}
            onPageSize={(size) => go({ size: size === 25 ? null : String(size), page: null, open: null })}
            openId={detail?.user.id ?? null}
            onOpen={(row) => go({ open: row.id })}
            empty={
              <div className="adm-u-state" data-tk="users-empty">
                <span className="adm-u-state-icon" aria-hidden="true"><SearchX /></span>
                <h3>{searching ? `No users match "${list.query.q}"` : "No users here yet"}</h3>
                <p>{searching ? "Try the exact email, a full phone number, an ad ID, or the first letters of a name." : "People show up here as soon as they sign up."}</p>
                {searching ? (
                  <Button
                    onClick={() => {
                      setSearch("");
                      sentSearch.current = "";
                      go({ q: null, page: null });
                    }}
                  >
                    Clear search
                  </Button>
                ) : null}
              </div>
            }
          />
        </div>
      </div>
      <UserDrawer detail={detail} onClose={() => go({ open: null })} access={access} />
    </div>
    </ToastProvider>
  );
}
