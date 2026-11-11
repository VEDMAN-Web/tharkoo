export function MainInner({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="min-w-0 flex-1">
      {children}
    </main>
  );
}
