import { Container } from "./ui/Container";
import { Prose } from "./ui/Prose";

export function StaticPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Container className="py-10">
      <article>
        <h1 className="t-h1">{title}</h1>
        <Prose className="mt-6">{children}</Prose>
      </article>
    </Container>
  );
}
