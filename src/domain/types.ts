// Pure domain types: no database or framework imports here.

export const CRITERIA = [
  "PROBLEM_SEVERITY",
  "CADRE_FIT",
  "CHAMPION",
  "DECISION_AUTHORITY",
  "FUNDING",
  "PROCUREMENT_PATH",
  "TIMELINE",
  "TECHNICAL_FEASIBILITY",
] as const;
export type Criterion = (typeof CRITERIA)[number];
export type Rating = "GREEN" | "YELLOW" | "RED" | "UNKNOWN";
export type Scorecard = Partial<Record<Criterion, { rating: Rating; updatedAt?: Date | string | null }>>;

export type Condition = { field: string; equals?: unknown; notEquals?: unknown };

type RuleBase = { key: string; label: string; when?: Condition };
export type GateRule = RuleBase &
  (
    | { type: "fieldsFilled"; fields: string[] }
    | { type: "fieldMatches"; field: string; in: unknown[] }
    | { type: "minCount"; collection: "stakeholders" | "successCriteria" | "requirements" | "licenses"; min: number }
    | { type: "activity"; activityType: string; min: number; problemFocused?: boolean }
    | { type: "document"; docType: string }
    | { type: "scorecardComplete" }
    | { type: "requirementsTagged" }
    | { type: "criteriaEvaluated" }
  );

export type StageDef = { number: number; name: string; gate: GateRule[]; onExit?: { setStatus?: string } | null };

/** Everything the gate engine needs to know about one opportunity. */
export type Snapshot = {
  stage: number;
  status: string;
  fields: Record<string, unknown>;
  stakeholders: number;
  licenses: number;
  successCriteria: { result: string | null; evidence: string | null }[];
  requirements: { tag: string | null }[];
  activities: { type: string; problemFocused?: boolean }[];
  documents: { type: string }[];
  scorecard: Scorecard;
};

export type TierRule = {
  name: string;
  minStage: number;
  requireGreen?: Criterion[];
  maxRed?: number;
  notRed?: Criterion[];
};

export type PipelineConfig = {
  tiers: TierRule[];
  awardWindowRequiresGreen: Criterion[];
  scorecardStaleDays: number;
  staleDealDays: number;
  renewalWindowDays: number;
  fiscalYearStartMonth: number;
};
