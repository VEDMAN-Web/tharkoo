"use client";

import { Button } from "@/components/admin/ui";

export type SaveLink = { href: string; label: string; tk: string };

/**
 * The ONE save bar of a master-detail screen (Categories & fields, Cities & areas): a dot and the words "Unsaved changes",
 * "Saved. Live on the site in a few seconds." with links to look at it, "All changes saved", then Discard and Save.
 */
export function SaveBar({ dirty, saved, busy, links, onDiscard, onSave }: { dirty: boolean; saved: boolean; busy: boolean; links: SaveLink[]; onDiscard: () => void; onSave: () => void }) {
  return (
    <div className="adm-k-savebar adm-cat-bar" role="region" aria-label="Save changes" data-tk="save-bar" data-dirty={dirty ? "yes" : "no"}>
      <span className={`adm-k-savedot${dirty ? " is-dirty" : ""}`} aria-hidden="true" />
      <span className="adm-k-savetext" aria-live="polite">
        <strong>{dirty ? "Unsaved changes" : saved ? "Saved. Live on the site in a few seconds." : "All changes saved"}</strong>{" "}
        {!dirty && saved ? (
          <span>
            {links.map((link, index) => (
              <span key={link.tk}>
                {index > 0 ? " · " : ""}
                <a href={link.href} target="_blank" rel="noopener" data-tk={link.tk}>{link.label}</a>
              </span>
            ))}
          </span>
        ) : null}
      </span>
      <span className="adm-k-sp" />
      <Button kind="quiet" disabled={!dirty || busy} onClick={onDiscard}>Discard</Button>
      <Button kind="primary" busy={busy} disabled={!dirty} onClick={onSave}>Save</Button>
    </div>
  );
}
