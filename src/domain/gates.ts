import { CRITERIA, type Condition, type GateRule, type Snapshot, type StageDef } from "./types";

export function isFilled(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

function conditionHolds(c: Condition | undefined, s: Snapshot): boolean {
  if (!c) return true;
  const v = s.fields[c.field];
  if ("equals" in c) return v === c.equals;
  if ("notEquals" in c) return v !== c.notEquals;
  return true;
}

function ruleMet(rule: GateRule, s: Snapshot): boolean {
  switch (rule.type) {
    case "fieldsFilled":
      return rule.fields.every((f) => isFilled(s.fields[f]));
    case "fieldMatches":
      return rule.in.includes(s.fields[rule.field]);
    case "minCount": {
      const n =
        rule.collection === "stakeholders" ? s.stakeholders
        : rule.collection === "licenses" ? s.licenses
        : rule.collection === "successCriteria" ? s.successCriteria.length
        : s.requirements.length;
      return n >= rule.min;
    }
    case "activity":
      return (
        s.activities.filter((a) => a.type === rule.activityType && (!rule.problemFocused || a.problemFocused === true))
          .length >= rule.min
      );
    case "document":
      return s.documents.some((d) => d.type === rule.docType);
    case "scorecardComplete":
      return CRITERIA.every((c) => {
        const r = s.scorecard[c]?.rating;
        return r !== undefined && r !== "UNKNOWN";
      });
    case "requirementsTagged":
      return s.requirements.every((r) => isFilled(r.tag));
    case "criteriaEvaluated":
      return s.successCriteria.length > 0 && s.successCriteria.every((c) => isFilled(c.result) && isFilled(c.evidence));
    default:
      // Unknown rule types in config fail closed.
      return false;
  }
}

export type GateItem = { key: string; label: string; met: boolean };

/** Checklist for one stage's exit gate. Rules whose `when` condition doesn't apply are omitted. */
export function evaluateGate(stage: StageDef, s: Snapshot): GateItem[] {
  return stage.gate
    .filter((r) => conditionHolds(r.when, s))
    .map((r) => ({ key: r.key, label: r.label, met: ruleMet(r, s) }));
}

export type MovePlan = {
  direction: "forward" | "backward" | "none";
  /** Unmet gate items, grouped by the stage whose exit gate they belong to. */
  unmet: { stage: number; name: string; items: string[] }[];
  /** Status to apply after the move, when a crossed stage defines one (e.g. Contract -> WON). */
  statusAfter: string | null;
};

/**
 * Plan a stage move. Moving forward N stages must satisfy the exit gate of every stage crossed.
 * Moving backward is always allowed (the caller requires and logs a reason).
 */
export function planMove(stages: StageDef[], s: Snapshot, target: number): MovePlan {
  const numbers = stages.map((x) => x.number);
  if (!numbers.includes(target)) throw new Error(`Unknown stage ${target}`);
  if (target === s.stage) return { direction: "none", unmet: [], statusAfter: null };
  if (target < s.stage) {
    // Moving back across a stage whose exit set the current status (e.g. WON after Contract) reopens the deal.
    const reopens = stages.some((x) => x.number >= target && x.number < s.stage && x.onExit?.setStatus === s.status);
    return { direction: "backward", unmet: [], statusAfter: reopens ? "OPEN" : null };
  }

  const unmet: MovePlan["unmet"] = [];
  let statusAfter: string | null = null;
  for (const st of stages.filter((x) => x.number >= s.stage && x.number < target).sort((a, b) => a.number - b.number)) {
    const items = evaluateGate(st, s).filter((i) => !i.met).map((i) => i.label);
    if (items.length) unmet.push({ stage: st.number, name: st.name, items });
    if (st.onExit?.setStatus) statusAfter = st.onExit.setStatus;
  }
  return { direction: "forward", unmet, statusAfter };
}
