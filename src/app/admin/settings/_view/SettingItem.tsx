import type { ReactNode } from "react";

/** One setting inside a Settings section: a small heading, one plain line, then the control. Every setting on the screen uses it. */
export function SettingItem({ id, title, help, children }: { id: string; title: string; help?: string; children: ReactNode }) {
  return (
    <section className="adm-s-item" aria-labelledby={id}>
      <h3 id={id} className="adm-s-item-h">{title}</h3>
      {help ? <p className="adm-k-help">{help}</p> : null}
      {children}
    </section>
  );
}
