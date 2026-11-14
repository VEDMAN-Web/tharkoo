export function StaticPage({ title, updated, children }: { title: string; updated?: string; children: React.ReactNode }) {
  return (
    <article className="tk-container tk-prose" style={{ padding: "28px 0 40px" }}>
      <h1>{title}</h1>
      <p>Last Updated: {updated || "November 2026"}</p>
      {children}
    </article>
  );
}
