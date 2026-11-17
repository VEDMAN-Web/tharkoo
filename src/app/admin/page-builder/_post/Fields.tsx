"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/admin/ui/Button";
import { ImagePicker, type ImageRef } from "@/components/admin/ui/ImagePicker";
import { TextField } from "@/components/admin/ui/TextField";
import { POST_BLOCK_TEXT_KEYS } from "@/components/post/copy";
import { TEXT_DEFAULTS, type UiTextKey } from "@/lib/ui/text";
import type { BlockBase } from "@/server/models/layout";
import { problemFor, TITLE_MAX, type Problem, type Props } from "./model";

type Fields = { block: BlockBase; problems: readonly Problem[]; fee: number; onChange: (patch: Props) => void };

const str = (value: unknown) => (typeof value === "string" ? value : "");
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.map(str) : []);

function feeHelp(fee: number) {
  return `Type {fee} to show the posting fee (now ${fee === 0 ? "free" : `${fee} ${fee === 1 ? "credit" : "credits"}`}).`;
}

const STEP_HELP: Record<string, string> = {
  basics: "The first line under the title. While it is left as it is and posting costs credits, the price is added.",
  review: "Shown above the summary. Empty uses the site text.",
};

export function StepFields({ block, problems, fee, onChange }: Fields) {
  const props = block.props as Props;
  const key = str(props.stepKey);
  return (
    <div className="adm-pb-fields" data-tk="step-fields">
      <TextField label="Title" required max={80} value={str(props.title)} error={problemFor(problems, block.id, "title")} onChange={(title) => onChange({ title })} />
      <TextField label="Help line under the title" multiline max={300} value={str(props.help)} help={`${STEP_HELP[key] ?? "Empty shows no help line, or the site text where the form has one."} ${feeHelp(fee)}`} onChange={(help) => onChange({ help })} />
      <div className="adm-pb-pair adm-pb-pair-2">
        <TextField label="Next button" max={40} value={str(props.nextLabel)} onChange={(nextLabel) => onChange({ nextLabel })} />
        <TextField label="Back button" max={40} value={str(props.backLabel)} onChange={(backLabel) => onChange({ backLabel })} />
      </div>
    </div>
  );
}

export function IntroFields({ block, problems, fee, onChange }: Fields) {
  const props = block.props as Props;
  const image = (props.image as ImageRef | null | undefined) ?? null;
  return (
    <div className="adm-pb-fields" data-tk="intro-fields">
      <TextField label="Title" required max={TITLE_MAX} value={str(props.title)} error={problemFor(problems, block.id, "title")} onChange={(title) => onChange({ title })} />
      <TextField label="Text" multiline max={500} value={str(props.text)} help={feeHelp(fee)} onChange={(text) => onChange({ text })} />
      <ImagePicker label="Picture (optional)" value={image} onChange={(next) => onChange({ image: next })} />
    </div>
  );
}

function ListEditor({
  id,
  label,
  itemLabel,
  max,
  itemMax,
  values,
  problems,
  blockId,
  prefix,
  onChange,
}: {
  id: string;
  label: string;
  itemLabel: string;
  max: number;
  itemMax: number;
  values: string[];
  problems: readonly Problem[];
  blockId: string;
  prefix: string;
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="adm-pb-fields" data-tk={`${id}-list`}>
      <span className="adm-field-label">{label}</span>
      {values.map((value, index) => (
        <div className="adm-pb-row" key={index}>
          <TextField label={`${itemLabel} ${index + 1}`} max={itemMax} value={value} error={problemFor(problems, blockId, `${prefix}-${index}`)} onChange={(next) => onChange(values.map((item, at) => (at === index ? next : item)))} />
          <Button size="sm" aria-label={`Remove ${itemLabel.toLowerCase()} ${index + 1}`} icon={X} onClick={() => onChange(values.filter((_, at) => at !== index))}>Remove</Button>
        </div>
      ))}
      {values.length < max ? (
        <div>
          <Button icon={Plus} size="sm" onClick={() => onChange([...values, ""])}>{`Add ${itemLabel.toLowerCase()}`}</Button>
        </div>
      ) : null}
    </div>
  );
}

export function PhotoRulesFields({ block, problems, onChange }: Fields) {
  const props = block.props as Props;
  return (
    <div className="adm-pb-fields" data-tk="photo-rules-fields">
      <TextField label="Title (optional)" max={TITLE_MAX} value={str(props.title)} onChange={(title) => onChange({ title })} />
      <ListEditor id="rules" label="Rules" itemLabel="Rule" max={10} itemMax={200} values={strings(props.items)} problems={problems} blockId={block.id} prefix="rule" onChange={(items) => onChange({ items })} />
      <p className="adm-field-help">The first rule is the line under the photo buttons.</p>
    </div>
  );
}

export function PromotionFields({ block, problems, fee, onChange }: Fields) {
  const props = block.props as Props;
  return (
    <div className="adm-pb-fields" data-tk="promotion-fields">
      <TextField label="Title (optional)" max={TITLE_MAX} value={str(props.title)} onChange={(title) => onChange({ title })} />
      <TextField label="Note under the plans" multiline max={300} value={str(props.note)} help={feeHelp(fee)} onChange={(note) => onChange({ note })} />
      <ListEditor id="plans" label="Show only these plans (leave empty to show all)" itemLabel="Plan code" max={10} itemMax={40} values={strings(props.products)} problems={problems} blockId={block.id} prefix="product" onChange={(products) => onChange({ products })} />
    </div>
  );
}

function CtaFields({ block, problems, field, label, onChange }: { block: BlockBase; problems: readonly Problem[]; field: "primaryCta" | "secondaryCta"; label: string; onChange: (patch: Props) => void }) {
  const props = block.props as Props;
  const value = (props[field] as { label?: string; href?: string } | null | undefined) ?? {};
  const set = (patch: { label?: string; href?: string }) => {
    const next = { label: str(value.label), href: str(value.href), ...patch };
    onChange({ [field]: next.label === "" && next.href === "" ? null : next });
  };
  return (
    <div className="adm-pb-pair adm-pb-pair-2">
      <TextField label={`${label} text`} max={60} value={str(value.label)} error={problemFor(problems, block.id, field)} onChange={(next) => set({ label: next })} />
      <TextField label={`${label} address`} max={500} value={str(value.href)} placeholder="/u/account/ads/" onChange={(next) => set({ href: next })} />
    </div>
  );
}

export function SuccessFields({ block, problems, fee, onChange }: Fields) {
  const props = block.props as Props;
  return (
    <div className="adm-pb-fields" data-tk="success-fields">
      <TextField label="Title (when the ad is live)" required max={TITLE_MAX} value={str(props.title)} error={problemFor(problems, block.id, "title")} onChange={(title) => onChange({ title })} />
      <TextField label="Text" multiline max={500} value={str(props.text)} help={feeHelp(fee)} onChange={(text) => onChange({ text })} />
      <CtaFields block={block} problems={problems} field="primaryCta" label="Main button" onChange={onChange} />
      <CtaFields block={block} problems={problems} field="secondaryCta" label="Second button" onChange={onChange} />
    </div>
  );
}

const TEXT_LABELS: Record<string, Record<string, string>> = {
  idCheckFirst: {
    verifyTitle: "Title when an ID check is needed",
    verifyText: "Text when an ID check is needed",
    verifyButton: "Button to start the check",
    checkingTitle: "Title while the team checks",
    checkingText: "Text while the team checks",
    backLink: "Link back to the account",
  },
  payStep: {
    title: "Card title",
    feeLabel: "Fee row",
    balanceLabel: "Balance row",
    afterLabel: "Balance after posting row",
    creditsTitle: "Title of the credits box",
    topUpLabel: "Top-up link",
  },
  consent: {
    agree: "Start of the terms line",
    terms: "Terms link text",
    and: "Word between the two links",
    privacy: "Privacy link text",
    adult: "Age and rights line",
  },
};

const LONG = new Set(["verifyText", "checkingText", "adult"]);

/** Texts only: empty uses the site text, which is shown grey in the field. */
export function TextsFields({ block, fee, onChange }: Fields) {
  const props = block.props as Props;
  const keys = POST_BLOCK_TEXT_KEYS[block.type] ?? {};
  return (
    <div className="adm-pb-fields" data-tk={`${block.type}-fields`}>
      {Object.entries(keys).map(([field, key]) => (
        <TextField
          key={field}
          label={TEXT_LABELS[block.type]?.[field] ?? field}
          multiline={LONG.has(field)}
          max={LONG.has(field) ? 300 : 80}
          value={str(props[field])}
          placeholder={TEXT_DEFAULTS[key as UiTextKey]}
          onChange={(next) => onChange({ [field]: next })}
        />
      ))}
      <p className="adm-field-help">Leave a field empty to use the site text (grey). {feeHelp(fee)} The fee, balance and plans come from Settings and the wallet, never from here.</p>
    </div>
  );
}
