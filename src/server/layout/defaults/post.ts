import { POST_COPY_DEFAULTS, POST_STEPS } from "@/components/post/copy";
import type { BlockBase } from "@/server/models/layout";

/**
 * The post-ad wizard's current wording written as blocks, so it looks the same once it reads a layout.
 * Ids are filled in on the server when the layout is saved.
 */
export function postDefaultBlocks(): Omit<BlockBase, "id">[] {
  const copy = POST_COPY_DEFAULTS;
  const steps: Omit<BlockBase, "id">[] = POST_STEPS.map((stepKey) => ({
    type: "postStep",
    visible: true,
    label: copy.steps[stepKey].title,
    props: { stepKey, ...copy.steps[stepKey] },
  }));
  return [
    // Hidden until an admin switches it on, so the wizard looks exactly as it does today.
    { type: "postIntro", visible: false, label: "Intro", props: { title: "Post an ad", text: "" } },
    ...steps,
    { type: "photoRules", visible: true, label: "Photo rules", props: { title: copy.photoRules.title, items: copy.photoRules.items } },
    { type: "promotionPicker", visible: true, label: "Promotion picker", props: { title: copy.promotion.title, products: [], note: copy.promotion.note } },
    {
      type: "postSuccess",
      visible: true,
      label: "After posting",
      props: {
        title: copy.success.title,
        text: copy.success.text,
        primaryCta: copy.success.primaryCta,
        secondaryCta: { label: "Post another ad", href: "/u/post-insert/" },
      },
    },
  ];
}
