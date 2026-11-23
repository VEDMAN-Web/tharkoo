import type { ReactNode } from "react";
import { legalNodes, type Inline, type LegalNode } from "./legal-markdown";
import "./legal-doc.css";

/** H17.14: draws the approved legal text (privacy, terms): paragraphs, headings, lists and the privacy table. */

function Text({ parts }: { parts: Inline[] }): ReactNode {
  return parts.map((part, index) => (part.strong ? <strong key={index}>{part.text}</strong> : part.text));
}

function Node({ node, label }: { node: LegalNode; label: string }) {
  if (node.kind === "h2") return <h2 id={node.id}>{node.text}</h2>;
  if (node.kind === "p") return <p><Text parts={node.parts} /></p>;
  if (node.kind === "table") {
    return (
      <div className="tkl-scroll" role="region" aria-label={label} tabIndex={0}>
        <table className="tkl-table">
          <thead>
            <tr>{node.head.map((cell, index) => <th key={index} scope="col"><Text parts={cell} /></th>)}</tr>
          </thead>
          <tbody>
            {node.rows.map((row, index) => (
              <tr key={index}>{row.map((cell, at) => <td key={at}><Text parts={cell} /></td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  const List = node.kind;
  return (
    <List className="tkl-list">
      {node.items.map((item, index) => <li key={index}><Text parts={item} /></li>)}
    </List>
  );
}

export function LegalDoc({ blocks, tableLabel }: { blocks: string[]; tableLabel: string }) {
  return (
    <div className="tkl-doc" data-tk="legal-doc">
      {legalNodes(blocks).map((node, index) => <Node key={index} node={node} label={tableLabel} />)}
    </div>
  );
}
