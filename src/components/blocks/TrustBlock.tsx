import { BlockIcon } from "./BlockIcon";

export function TrustBlock({ items = [] }: { items?: { icon?: string; text: string }[] }) {
  if (!items.length) return null;
  return (
    <section className="tk-block tk-block-trust">
      <ul>
        {items.map((item) => (
          <li key={item.text}>
            <BlockIcon name={item.icon} />
            <span>{item.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
