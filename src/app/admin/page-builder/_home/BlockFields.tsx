"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/admin/ui/Button";
import { MoveButtons } from "@/components/admin/ui/MoveButtons";
import { TextField } from "@/components/admin/ui/TextField";
import type { BlockBase } from "@/server/models/layout";
import { problemFor, STEP_MAX, TITLE_MAX, TRUST_MAX, type Problem, type Props } from "./model";

type Fields = { block: BlockBase; problems: readonly Problem[]; onChange: (patch: Props) => void };

const items = (value: unknown): Props[] => (Array.isArray(value) ? (value as Props[]) : []);
const str = (value: unknown) => (typeof value === "string" ? value : "");

function swap<T>(list: readonly T[], from: number, to: number): T[] {
  const next = list.slice();
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

function Stepper({ id, label, value, min, max, unit, onChange }: { id: string; label: string; value: number; min: number; max: number; unit: string; onChange: (next: number) => void }) {
  return (
    <div className="adm-field">
      <span className="adm-field-label" id={`${id}-count`}>{label}</span>
      <div className="adm-pb-stepper" role="group" aria-labelledby={`${id}-count`}>
        <Button size="sm" aria-label={`Show one fewer ${unit}`} disabled={value <= min} onClick={() => onChange(value - 1)}>-</Button>
        <output data-tk="stepper-value" aria-live="polite">{value}</output>
        <Button size="sm" aria-label={`Show one more ${unit}`} disabled={value >= max} onClick={() => onChange(value + 1)}>+</Button>
      </div>
    </div>
  );
}

export function CategoriesFields({ block, problems, onChange }: Fields) {
  const props = block.props as Props;
  const count = Number(props.count) || 4;
  return (
    <div className="adm-pb-fields" data-tk="categories-fields">
      <TextField label="Small line above the title (optional)" max={60} value={str(props.eyebrow)} onChange={(eyebrow) => onChange({ eyebrow })} />
      <TextField label="Title" required max={TITLE_MAX} value={str(props.title)} error={problemFor(problems, block.id, "title")} onChange={(title) => onChange({ title })} />
      <TextField label="Link text to all categories (optional)" max={60} value={str(props.allText)} onChange={(allText) => onChange({ allText })} />
      <Stepper id={block.id} label="How many on Home" value={count} min={1} max={8} unit="category" onChange={(next) => onChange({ count: next })} />
      <p className="adm-field-help">Shows the first {count} in the order set in Categories &amp; fields. Photos and ads come from each category.</p>
    </div>
  );
}

export function StepsFields({ block, problems, onChange }: Fields) {
  const props = block.props as Props;
  const steps = items(props.items);
  const set = (index: number, patch: Props) => onChange({ items: steps.map((step, at) => (at === index ? { ...step, ...patch } : step)) });
  return (
    <div className="adm-pb-fields" data-tk="steps-fields">
      <TextField label="Small line above the title (optional)" max={60} value={str(props.eyebrow)} onChange={(eyebrow) => onChange({ eyebrow })} />
      <TextField label="Title" required max={TITLE_MAX} value={str(props.title)} error={problemFor(problems, block.id, "title")} onChange={(title) => onChange({ title })} />
      {steps.map((step, index) => (
        <div className="adm-pb-pair" key={index}>
          <TextField label={`Step ${index + 1} title`} required max={80} value={str(step.title)} error={problemFor(problems, block.id, `step-${index}`)} onChange={(title) => set(index, { title })} />
          <TextField label={`Step ${index + 1} text`} multiline max={300} value={str(step.text)} onChange={(text) => set(index, { text })} />
          <span className="adm-pb-pair-tools">
            <MoveButtons name={`step ${index + 1}`} canUp={index > 0} canDown={index < steps.length - 1} onUp={() => onChange({ items: swap(steps, index, index - 1) })} onDown={() => onChange({ items: swap(steps, index, index + 1) })} />
            <Button size="sm" icon={X} aria-label={`Remove step ${index + 1}`} title="Remove step" onClick={() => onChange({ items: steps.filter((_, at) => at !== index) })}>
              Remove
            </Button>
          </span>
        </div>
      ))}
      {steps.length < STEP_MAX ? (
        <Button icon={Plus} onClick={() => onChange({ items: [...steps, { title: "", text: "" }] })}>
          Add a step
        </Button>
      ) : null}
      <p className="adm-field-help">{"{fee}"} is filled in from Prices &amp; plans, so the price is never typed twice.</p>
    </div>
  );
}

export function TrustFields({ block, problems, onChange }: Fields) {
  const labels = items((block.props as Props).items);
  const set = (next: Props[]) => onChange({ items: next });
  return (
    <div className="adm-pb-fields" data-tk="trust-fields">
      {labels.map((item, index) => (
        <div className="adm-pb-row" key={index}>
          <TextField label={`Item ${index + 1}`} max={60} value={str(item.label)} error={problemFor(problems, block.id, `trust-${index}`)} onChange={(label) => set(labels.map((one, at) => (at === index ? { ...one, label } : one)))} />
          <Button size="sm" icon={X} aria-label={`Remove item ${index + 1}`} title="Remove item" onClick={() => set(labels.filter((_, at) => at !== index))}>
            Remove
          </Button>
        </div>
      ))}
      {labels.length < TRUST_MAX ? (
        <Button icon={Plus} onClick={() => set([...labels, { label: "" }])}>
          Add an item
        </Button>
      ) : null}
    </div>
  );
}

export function PostsFields({ block, problems, onChange }: Fields) {
  const props = block.props as Props;
  return (
    <div className="adm-pb-fields" data-tk="posts-fields">
      <TextField label="Title" required max={TITLE_MAX} value={str(props.title)} error={problemFor(problems, block.id, "title")} onChange={(title) => onChange({ title })} />
      <Stepper id={block.id} label="How many posts" value={Number(props.count) || 3} min={1} max={6} unit="post" onChange={(next) => onChange({ count: next })} />
    </div>
  );
}
