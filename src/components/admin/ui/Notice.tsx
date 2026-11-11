export type NoticeKind = "info" | "warn" | "error";

export function Notice({ kind = "info", title, children }: { kind?: NoticeKind; title?: string; children?: React.ReactNode }) {
  return (
    <div className={`adm-notice adm-notice-${kind}`} role={kind === "error" ? "alert" : "status"}>
      {title ? <strong className="adm-notice-title">{title}</strong> : null}
      {children}
    </div>
  );
}
