import { Check, Lock } from "lucide-react";
import type { TextFn } from "@/lib/ui/text";
import type { SellerDashboard } from "@/server/listings/seller-dashboard";
import { GoalForm } from "./GoalForm";
import { num } from "./format";

const NAMES = {
  views100: "panel.dash.milestoneViews100",
  views1000: "panel.dash.milestoneViews1000",
  clicks100: "panel.dash.milestoneClicks100",
  views5000: "panel.dash.milestoneViews5000",
} as const;

/** H14.3: this week's goal (Monday to Sunday, India) and the milestones from real all-time numbers. */
export function DashGoal({ goal, milestones, t }: { goal: SellerDashboard["goal"]; milestones: SellerDashboard["milestones"]; t: TextFn }) {
  const line =
    goal.remaining === 0
      ? t("panel.dash.goalDone")
      : goal.daysLeft === 1
        ? t("panel.dash.goalLeftOne", { count: num(goal.remaining) })
        : t("panel.dash.goalLeft", { count: num(goal.remaining), days: goal.daysLeft });
  const texts = { change: t("panel.dash.goalChange"), label: t("panel.dash.goalLabel"), save: t("panel.dash.goalSave"), cancel: t("panel.dash.goalCancel"), error: t("panel.dash.goalError") };
  return (
    <section aria-labelledby="dash-goal-h" className="up-dash-card up-dash-goal" data-tk="dash-goal">
      <div className="up-dash-goal-head">
        <h2 id="dash-goal-h" className="up-dash-h2">{t("panel.dash.goalTitle")}</h2>
        <GoalForm goal={goal.goal} texts={texts} />
      </div>
      <div className="up-dash-goal-body">
        <div className="up-dash-ring-wrap">
          <div
            className="up-dash-ring"
            role="img"
            aria-label={`${num(goal.views)} of ${num(goal.goal)} views, ${goal.percent} percent`}
            style={{ background: `conic-gradient(#d1137a 0% ${goal.percent}%, #f3e8f7 ${goal.percent}% 100%)` }}
          >
            <div className="up-dash-ring-in">{goal.percent}%</div>
          </div>
          <div className="up-dash-goal-text">
            <span className="up-dash-goal-num" data-tk="goal-numbers">{t("panel.dash.goalRing", { views: num(goal.views), goal: num(goal.goal) })}</span>
            <span className="up-dash-goal-line" data-tk="goal-line">{line}</span>
          </div>
        </div>
        <ul className="up-dash-miles" data-tk="dash-milestones">
          {milestones.map((item) => (
            <li key={item.key} className={item.done ? "up-dash-mile up-dash-mile-done" : "up-dash-mile"} data-tk="milestone" data-done={item.done ? "yes" : "no"}>
              <span className="up-dash-mile-dot" aria-hidden="true">
                {item.done ? <Check size={16} strokeWidth={2.6} /> : <Lock size={14} strokeWidth={2.4} />}
              </span>
              <span className="up-dash-mile-text">
                <span className="up-dash-mile-name">{t(NAMES[item.key as keyof typeof NAMES])}</span>
                <span className="up-dash-mile-note">{item.done ? t("panel.dash.milestoneDone") : t("panel.dash.milestoneSoFar", { count: num(item.so) })}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
