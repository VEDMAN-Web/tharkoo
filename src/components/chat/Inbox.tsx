"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ImageIcon, MessageSquare } from "lucide-react";
import { api, friendlyError } from "@/lib/ui/api";
import { chatTime } from "@/lib/ui/chat-time";
import { adHref } from "@/lib/urls";
import { EmptyIcon } from "@/components/buyer/UserPanelShell";
import { useUrlPaths } from "@/components/UrlPaths";
import { MiniAdCard } from "@/components/ui/MiniAdCard";
import { ChatThread } from "./ChatThread";
import { SkRows } from "@/components/ui/Sk";

type Row = {
  id: string;
  listingTitle: string;
  role: "buyer" | "seller";
  lastText: string;
  lastMessageAt: string;
  unread: number;
  blocked: boolean;
  peerName: string;
  cover: string | null;
  adSlug: string | null;
  adAddress?: string | null;
  adLive: boolean;
};

function Thumb({ row }: { row: Row }) {
  return (
    <span className="up-chat-thumb" aria-hidden="true">
      {row.cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.cover} alt="" loading="lazy" />
      ) : (
        <ImageIcon size={20} focusable="false" />
      )}
    </span>
  );
}

export function Inbox() {
  const paths = useUrlPaths();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState("");

  useEffect(() => {
    let live = true;
    const read = async () => {
      const res = await api<Row[]>("/api/chat/conversations");
      if (!live) return;
      if (res.ok) setRows(res.data);
      else {
        setRows([]);
        setError(res.status === 401 ? "Sign in to see your messages." : friendlyError(res.error));
      }
    };
    const first = window.setTimeout(() => void read(), 0);
    const timer = window.setInterval(() => void read(), 15000);
    return () => {
      live = false;
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, []);

  if (rows === null) return <SkRows label="Loading chats" rows={4} />;
  const open = rows.find((row) => row.id === openId) ?? null;
  return (
    <div className="up-inbox" data-open={open ? "yes" : "no"}>
      <section aria-label="Conversations" className="up-inbox-list">
        {error ? <p role="alert" className="up-note">{error}</p> : null}
        {!error && rows.length === 0 ? (
          <div className="up-empty">
            <EmptyIcon icon={MessageSquare} />
            <p className="up-empty-title">No chats yet</p>
            <p className="up-empty-body">Chats you start with advertisers, and people who message you, show here.</p>
            <Link href="/search/" className="up-btn">Browse ads</Link>
          </div>
        ) : null}
        <ul className="up-chat-rows">
          {rows.map((row) => (
            <li key={row.id}>
              <button type="button" className="up-chat-row" data-tk="chat-row" data-unread={row.unread > 0 ? "yes" : "no"} aria-current={openId === row.id} onClick={() => setOpenId(row.id)}>
                <Thumb row={row} />
                <span className="up-chat-main">
                  <span className="up-chat-top">
                    <strong className="up-chat-name">{row.peerName}</strong>
                    <span className="up-chat-time">{chatTime(row.lastMessageAt)}</span>
                  </span>
                  <span className="up-chat-ad">{row.listingTitle || "Ad"}</span>
                  <span className="up-chat-last">{row.blocked ? "Blocked" : row.lastText || "No messages yet"}</span>
                </span>
                {row.unread > 0 ? <span className="up-chat-dot" role="img" aria-label={`${row.unread} unread`} data-tk="chat-unread" /> : null}
              </button>
            </li>
          ))}
        </ul>
      </section>
      {open ? (
        <section aria-label="Conversation" className="up-inbox-thread">
          <div className="up-thread-head">
            <button type="button" className="up-thread-back" data-tk="chat-back" onClick={() => setOpenId("")}>
              <ArrowLeft size={18} aria-hidden="true" focusable="false" />
              All chats
            </button>
            {open.adSlug && open.adLive ? (
              <>
                <div className="up-chat-main">
                  <strong className="up-chat-name">{open.peerName}</strong>
                </div>
                <MiniAdCard href={adHref(paths, { slug: open.adSlug, address: open.adAddress })} title={open.listingTitle || "Ad"} photo={open.cover} dataTk="chat-ad-card" />
              </>
            ) : (
              <>
                <Thumb row={open} />
                <div className="up-chat-main">
                  <strong className="up-chat-name">{open.peerName}</strong>
                  <span className="up-chat-ad">{open.listingTitle || "Ad"}</span>
                </div>
              </>
            )}
          </div>
          <div className="up-thread-body">
            <ChatThread key={open.id} conversationId={open.id} hideTitle />
          </div>
        </section>
      ) : null}
    </div>
  );
}
