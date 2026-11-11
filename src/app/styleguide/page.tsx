import type { ListingDoc } from "@/lib/models";
import { pageMetadata } from "@/lib/ui/meta";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Chip, ChipRow } from "@/components/ui/Chip";
import { Field, Input } from "@/components/ui/Input";
import { AdCard } from "@/components/ui/AdCard";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdCardSkeleton } from "@/components/ui/Skeleton";
import { Gallery } from "@/components/ui/Gallery";
import { StyleDialog } from "@/components/ui/StyleDialog";

export const metadata = pageMetadata({
  title: "Design system | Tharkoo",
  description: "Ivory and gold tokens and components.",
  path: "/styleguide/",
  index: false,
});

const swatches = [
  ["bg", "#FFFDFB"],
  ["card", "#FFFFFF"],
  ["primary", "#8A6416"],
  ["gold", "#D4AF37"],
  ["text", "#1F2433"],
  ["muted", "#6E7180"],
];

function ad(variant: string, title: string, photo?: string): ListingDoc {
  return {
    slug: `sample-${variant}`,
    title,
    description: "A long sample description that wraps onto a second line so the card clamp can be reviewed on a wide screen.",
    categorySlug: "jobs",
    citySlug: "bengaluru",
    place: "Bengaluru",
    photos: photo ? [photo] : [],
    variant,
    verified: variant !== "free",
    publishedAt: new Date(),
    publicId: variant,
  };
}

export default function StyleGuide() {
  const photo = "/brand/placeholders/generic.svg";
  return (
    <Container className="py-10">
      <h1 className="t-h1">Design system</h1>
      <p className="t-lead mt-3 max-w-[68ch] text-muted">Ivory and gold. Light surfaces, gold for action.</p>
      <h2 className="t-h2 mt-10">Colour</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {swatches.map(([name, hex]) => (
          <div key={name} className="rounded-lg border border-line p-3">
            <div className="h-12 rounded-md border border-line" style={{ background: hex }} />
            <p className="t-caption mt-2">{name} {hex}</p>
          </div>
        ))}
      </div>
      <h2 className="t-h2 mt-10">Type</h2>
      <p className="t-display mt-4">Display</p>
      <p className="t-h1">Heading one</p>
      <p className="t-h2">Heading two</p>
      <p className="t-h3">Heading three</p>
      <p className="t-lead">Lead copy for introductions.</p>
      <p className="t-body">Body copy stays at 16 pixels.</p>
      <p className="t-small">Small text at 14.</p>
      <p className="t-caption">Caption at 12.</p>
      <p className="t-overline">Overline</p>
      <h2 className="t-h2 mt-10">Buttons</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="danger">Danger</Button>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
        <Button loading>Loading</Button>
        <Button disabled>Disabled</Button>
      </div>
      <h2 className="t-h2 mt-10">Fields</h2>
      <div className="mt-4 grid max-w-md gap-3">
        <Field id="sg-name" label="Name" hint="Shown on your account">
          <Input id="sg-name" placeholder="Name" />
        </Field>
        <Field id="sg-bad" label="Email" error="Enter a valid email">
          <Input id="sg-bad" defaultValue="not-an-email" />
        </Field>
      </div>
      <h2 className="t-h2 mt-10">Chips and badges</h2>
      <ChipRow>
        <Chip selected>Selected</Chip>
        <Chip href="/search/">Link chip</Chip>
      </ChipRow>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge tone="new">New</Badge>
        <Badge tone="highlight">Highlight</Badge>
        <Badge tone="top">Top</Badge>
        <Badge tone="supertop">Super Top</Badge>
        <Badge tone="star">Star</Badge>
        <Badge tone="verified">Verified</Badge>
        <Badge tone="live">Available now</Badge>
      </div>
      <h2 className="t-h2 mt-10">Cards</h2>
      <div className="mt-4 grid gap-4">
        <AdCard ad={ad("free", "A very long free listing title that should clamp to two lines on the card")} />
        <AdCard ad={ad("free", "Fresh listing", photo)} />
        <AdCard ad={ad("highlight", "Highlighted listing with a long title", photo)} />
        <AdCard ad={ad("top", "Top listing", photo)} />
        <AdCard ad={ad("supertop", "Super top listing", photo)} />
        <AdCard ad={ad("star", "Star listing without a photo")} featured />
      </div>
      <h2 className="t-h2 mt-10">Gallery</h2>
      <div className="mt-4 grid min-w-0 gap-6">
        <Gallery photos={[]} title="Empty gallery" seed="none" category="jobs" />
        <Gallery photos={[photo]} title="One photo" seed="one" category="property" />
        <Gallery photos={[photo, photo, photo, photo, photo, photo]} title="Six photos" seed="six" category="vehicles" />
      </div>
      <h2 className="t-h2 mt-10">Breadcrumbs, empty, skeleton, dialog</h2>
      <Breadcrumbs crumbs={[{ name: "Home", path: "/" }, { name: "Jobs", path: "/jobs/" }, { name: "Sample", path: "/styleguide/" }]} />
      <EmptyState title="Nothing here" body="Every empty state needs a next step." action={{ href: "/", label: "Go home" }} />
      <AdCardSkeleton />
      <StyleDialog />
    </Container>
  );
}
