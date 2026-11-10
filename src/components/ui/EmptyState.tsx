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
    <div className="mx-auto grid max-w-md justify-items-center gap-4 py-10 text-center">
      <div className="h-40 w-32 overflow-hidden rounded-lg">
        <PlaceholderArt seed={title} category={icon} decorative />
      </div>
      <Title className={heading === "h1" ? "t-h1" : "t-h2"}>{title}</Title>
      <p className="t-body text-muted">{body}</p>
      {action ? (
        <Button href={action.href} prefetch={false}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
