"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, PageHeader, TextField, ToastProvider, useToast } from "@/components/admin/ui";
import type { SocialStatus } from "@/server/site-links/social-status";
import type { ShellConfig, ShellImage } from "@/server/site-links/shell-config-rules";
import { ContactList, LinkList } from "./ListEditors";
import { MenusTabs } from "./MenusTabs";
import { saveShellAction } from "./actions";
import "./menus.css";

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const LEAVE = "You have unsaved changes. Leave without saving?";

function Card({ id, title, help, children }: { id: string; title: string; help?: string; children: React.ReactNode }) {
  return (
    <section className="adm-card adm-menu-card" aria-labelledby={id} data-tk={`card-${id}`}>
      <header className="adm-menu-cardhead">
        <h2 id={id}>{title}</h2>
        {help ? <p className="adm-k-help">{help}</p> : null}
      </header>
      <div className="adm-menu-cardbody">{children}</div>
    </section>
  );
}

/** The old pictures rows: not edited here any more (category and city pictures have their own screens), still listed so staff know they exist. */
function PicturesMoved({ items }: { items: ShellImage[] }) {
  return (
    <section className="adm-card adm-menu-card" aria-labelledby="pictures-moved" data-tk="pictures-moved">
      <header className="adm-menu-cardhead">
        <h2 id="pictures-moved">Category and city pictures</h2>
      </header>
      <div className="adm-menu-cardbody">
        <p className="adm-k-help">
          Category and city pictures are now set in <Link href="/admin/categories/">Categories &amp; fields</Link> and <Link href="/admin/locations/">Cities &amp; areas</Link>.
        </p>
        {items.length ? (
          <>
            <p className="adm-k-help">These older rows are still stored here. The site uses one of them only when the new boxes have no picture for that slot, so you can leave them as they are.</p>
            <ul className="adm-menu-old" data-tk="pictures-old-rows">
              {items.map((item, index) => (
                <li key={`${item.scope}-${item.slug}-${index}`}>
                  {item.scope === "category" ? "Category" : item.scope === "city" ? "City" : "State"} {item.slug}: {[item.photo ? "card photo" : "", item.band ? "band for computers" : "", item.bandPhone ? "band for phones" : ""].filter(Boolean).join(", ")}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </section>
  );
}

function SocialLive({ status }: { status: SocialStatus[] }) {
  return (
    <div className="adm-menu-live" data-tk="social-live">
      <h3>On the site today</h3>
      <p className="adm-k-help">The footer always draws these six icons. A visible link above whose text is the network name sets where its icon goes.</p>
      <ul>
        {status.map((item) => (
          <li key={item.name} data-source={item.source}>
            <strong>{item.name}</strong>
            <span>
              {item.source === "link" ? `opens ${item.href}` : item.source === "default" ? `uses the default address ${item.href}` : "no address yet: the icon shows greyed and opens nothing"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Screen({ initial, social }: { initial: ShellConfig; social: SocialStatus[] }) {
  const toast = useToast();
  const [base, setBase] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const dirty = !same(draft, base);
  const { header, footer } = draft;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const onClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.origin !== window.location.origin || link.pathname === window.location.pathname) return;
      if (!window.confirm(LEAVE)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  const undo = useCallback(
    async (previous: ShellConfig) => {
      const result = await saveShellAction(previous);
      if (!result.ok) return toast.show({ kind: "error", message: result.error });
      setBase(result.config);
      setDraft(result.config);
      toast.show({ kind: "success", message: "Back to the version before this save." });
    },
    [toast],
  );

  async function save() {
    const previous = base;
    setBusy(true);
    const result = await saveShellAction(draft);
    setBusy(false);
    if (!result.ok) return toast.show({ kind: "error", message: result.error });
    setBase(result.config);
    setDraft(result.config);
    toast.show({ kind: "undo", message: "Saved. The site picks this up within a minute.", onUndo: () => void undo(previous) });
  }

  const set = useMemo(
    () => ({
      header: (patch: Partial<ShellConfig["header"]>) => setDraft((current) => ({ ...current, header: { ...current.header, ...patch } })),
      footer: (patch: Partial<ShellConfig["footer"]>) => setDraft((current) => ({ ...current, footer: { ...current.footer, ...patch } })),
    }),
    [],
  );

  return (
    <div className="adm-k" data-tk="menus-screen" data-dirty={dirty ? "yes" : "no"}>
      <PageHeader crumbs={[{ label: "Website" }]} title="Menus and footer" purpose="Header links, footer columns and contact rows on every public page." />
      <MenusTabs current="/admin/menus/" />
      <p className="adm-k-help adm-menu-intro">The account menu and the Log in and Post your ad targets stay fixed so login and posting keep working.</p>
      <div className="adm-menu-stack">
        <Card id="header-edit" title="Header">
          <div className="adm-menu-two">
            <TextField label="Log in button" value={header.loginLabel} max={200} onChange={(loginLabel) => set.header({ loginLabel })} />
            <TextField label="Post your ad button" value={header.postLabel} max={200} onChange={(postLabel) => set.header({ postLabel })} />
          </div>
          <h3 className="adm-menu-sub">Menu links</h3>
          <LinkList name="menu" items={header.navLinks} onChange={(navLinks) => set.header({ navLinks })} />
        </Card>

        <Card id="footer-about" title="About text and trust pills">
          <TextField label="About text" multiline max={400} value={footer.about} onChange={(about) => set.footer({ about })} />
          <TextField
            label="Trust pills (one per line)"
            multiline
            help="Up to six short lines, shown as pills under the about text."
            value={footer.trust.join("\n")}
            onChange={(value) => set.footer({ trust: value.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 6) })}
          />
        </Card>

        <Card id="footer-quick" title="Quick links">
          <LinkList name="quick" items={footer.quickLinks} onChange={(quickLinks) => set.footer({ quickLinks })} />
        </Card>

        <Card id="footer-top" title="Top categories" help="Leave empty to show the first six categories.">
          <LinkList name="top" items={footer.topCategories} onChange={(topCategories) => set.footer({ topCategories })} emptyText="Empty: the footer shows the first six categories." />
        </Card>

        <Card id="footer-touch" title="Get in touch">
          <ContactList items={footer.contacts} onChange={(contacts) => set.footer({ contacts })} />
        </Card>

        <Card id="footer-legal" title="Legal pills">
          <LinkList name="legal" items={footer.legal} onChange={(legal) => set.footer({ legal })} />
        </Card>

        <Card id="footer-social" title="Social links" help="Write the network name as the text (WhatsApp, X, LinkedIn, Instagram, Pinterest or Telegram) and the address it should open.">
          <LinkList name="social" items={footer.socials} onChange={(socials) => set.footer({ socials })} emptyText="No social links saved here. The site uses the older social links of the site record, listed below." />
          <SocialLive status={social} />
        </Card>

        <Card id="footer-notices" title="Adults notice and copyright">
          <TextField label="Adults notice" max={200} value={footer.adultNotice} onChange={(adultNotice) => set.footer({ adultNotice })} />
          <TextField label="Copyright line" max={200} value={footer.copyright} onChange={(copyright) => set.footer({ copyright })} />
        </Card>

        <PicturesMoved items={draft.media.images} />
      </div>

      <div className="adm-k-savebar adm-menu-bar" role="region" aria-label="Save changes" data-tk="save-bar" data-dirty={dirty ? "yes" : "no"}>
        <span className={`adm-k-savedot${dirty ? " is-dirty" : ""}`} aria-hidden="true" />
        <span className="adm-k-savetext" aria-live="polite">
          <strong>{dirty ? "Unsaved changes" : "All changes saved"}</strong>
        </span>
        <span className="adm-k-sp" />
        <Button kind="quiet" disabled={!dirty || busy} onClick={() => setDraft(base)}>Discard</Button>
        <Button kind="primary" busy={busy} disabled={!dirty} onClick={() => void save()}>Save</Button>
      </div>
    </div>
  );
}

/** Menus and footer (H8.54): the header and footer as cards, compact link rows, one save bar with Undo. */
export function MenusEditor({ initial, social }: { initial: ShellConfig; social: SocialStatus[] }) {
  return (
    <ToastProvider>
      <Screen initial={initial} social={social} />
    </ToastProvider>
  );
}
