export function VendorShell({ children }: { title?: string; children: React.ReactNode; verified?: boolean }) {
  return <div className="tk-container" style={{ padding: "8px 0 40px" }}>{children}</div>;
}

export function Tile({ title, children, href }: { title: string; children: React.ReactNode; href: string }) {
  return (
    <a href={href} className="tk-tile-link">
      <h2>{title}</h2>
      <div>{children}</div>
    </a>
  );
}
