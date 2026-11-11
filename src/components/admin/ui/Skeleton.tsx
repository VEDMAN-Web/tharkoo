export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="adm-skeleton" aria-busy="true" aria-label="Loading">
      {Array.from({ length: lines }, (_, index) => (
        <i key={index} style={{ width: index === lines - 1 ? "60%" : "100%" }} />
      ))}
    </div>
  );
}
