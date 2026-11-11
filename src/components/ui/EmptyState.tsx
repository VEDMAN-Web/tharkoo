import { PlaceholderArt } from "./PlaceholderArt";
import { Button } from "./Button";

export function EmptyState({
  icon = "generic",
  title,
  body,
  action,
  heading = "h2",
}: {
  icon?: string;
  title: string;
  body: string;
  action?: { href: string; label: string };
  heading?: "h1" | "h2";
}) {
  const Title = heading;
  return (
    <div className="tk-empty">
      <div className="mx-auto h-40 w-32 overflow-hidden rounded-lg">
        <PlaceholderArt seed={title} category={icon} decorative />
      </div>
      <Title className={heading === "h1" ? "tk-page-h1" : "t-h2"}>{title}</Title>
      <p className="t-body" style={{ color: "var(--muted)" }}>{body}</p>
      {action ? (
        <Button href={action.href} prefetch={false}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
