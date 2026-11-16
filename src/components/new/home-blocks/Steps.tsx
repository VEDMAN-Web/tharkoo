import { SectionHead } from "./SectionHead";

const STEPS_SHOWN = 3;

export function HomeSteps({ eyebrow, title, steps }: { eyebrow: string; title: string; steps: { title: string; text: string }[] }) {
  return (
    <section className="tkh-page tkh-section" aria-labelledby="home-how">
      <SectionHead id="home-how" eyebrow={eyebrow} tone="rose" title={title} />
      <ol className="tkh-steps">
        {steps.slice(0, STEPS_SHOWN).map((step, index) => (
          <li className="tkh-step" key={step.title}>
            <span className="tkh-step-n" aria-hidden="true">
              {index + 1}
            </span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
