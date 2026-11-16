import Link from "next/link";
import type { ProfileStep } from "@/lib/ui/profile-progress";

export function ProfileCard({ percent, missing }: { percent: number; missing: ProfileStep[] }) {
  return (
    <section aria-labelledby="profile-heading" className="up-glass up-panel up-profile" data-tk="profile-card">
      <div className="up-panel-head">
        <h2 id="profile-heading" className="up-h2">Your profile</h2>
        <span className="up-profile-pct" data-tk="profile-percent">{percent}%</span>
      </div>
      <div className="up-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Profile complete">
        <i style={{ width: `${percent}%` }} />
      </div>
      {missing.length ? (
        <>
          <p className="up-muted">Advertisers with a full profile get more replies.</p>
          <ul className="up-profile-steps">
            {missing.map((step) => (
              <li key={step.key}>
                <Link href={step.href} data-tk="profile-step">{step.label}</Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="up-muted">Your profile is complete. Advertisers like you get the most replies.</p>
      )}
    </section>
  );
}
