export function StaticPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="prose max-w-2xl">
      <h1 className="text-[28px] font-normal text-[#222]">{title}</h1>
      <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--text-secondary)]">{children}</div>
    </article>
  );
}
