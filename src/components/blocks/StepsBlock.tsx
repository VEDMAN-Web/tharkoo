import { BlockIcon } from "./BlockIcon";

interface Item {
  icon?: string;
  title: string;
  text?: string;
}

export function StepsBlock({ title, items = [] }: { title?: string; items?: Item[] }) {
  if (!items.length) return null;
  return (
    <section className="tk-block tk-block-steps">
      {title ? <h2>{title}</h2> : null}
      <ol>
        {items.map((item) => (
          <li key={item.title}>
            <BlockIcon name={item.icon} />
            <span>
              <strong>{item.title}</strong>
              {item.text}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
