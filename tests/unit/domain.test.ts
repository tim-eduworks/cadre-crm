import { describe, expect, it } from "vitest";
import stagesJson from "@config/stages.json";
import tiersJson from "@config/tiers.json";
import { evaluateGate, planMove } from "@/domain/gates";
import {
  awardWindowUnlocked, confidenceTier, effectiveAwardWindow, fiscalQuarter, formatAwardWindow, isStale, staleCriteria,
} from "@/domain/scorecard";
import { summarize } from "@/domain/forecast";
import { CRITERIA, type PipelineConfig, type Rating, type Scorecard, type Snapshot, type StageDef } from "@/domain/types";

const stages = stagesJson as StageDef[];
const cfg = tiersJson as PipelineConfig;

const card = (all: Rating, over: Partial<Record<(typeof CRITERIA)[number], Rating>> = {}): Scorecard =>
  Object.fromEntries(CRITERIA.map((c) => [c, { rating: over[c] ?? all, updatedAt: new Date() }]));

const snap = (over: Partial<Snapshot> = {}): Snapshot => ({
  stage: 1, status: "OPEN", fields: {}, stakeholders: 0, licenses: 0, successCriteria: [], requirements: [],
  activities: [], documents: [], scorecard: {}, ...over,
});
const stage = (n: number) => stages.find((s) => s.number === n)!;
const unmetKeys = (n: number, s: Snapshot) => evaluateGate(stage(n), s).filter((i) => !i.met).map((i) => i.key);

describe("stage config", () => {
  it("has the 12 playbook stages in order", () => {
    expect(stages.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(stages[0].name).toBe("Identify Problem");
    expect(stages[11].name).toBe("Expand & Renew");
  });
});

describe("gates", () => {
  it("stage 1 needs problem + impact, org and a contact", () => {
    expect(unmetKeys(1, snap())).toEqual(["problem", "org", "contact"]);
    expect(unmetKeys(1, snap({ fields: { problem: "p", impact: "  " }, stakeholders: 1 }))).toEqual(["problem", "org"]);
    expect(unmetKeys(1, snap({ fields: { problem: "p", impact: "i", organizationId: "o" }, stakeholders: 1 }))).toEqual([]);
  });

  it("stage 2 needs desired state, a criterion, discovery notes and a meeting", () => {
    const s = snap({ fields: { problem: "p", impact: "i", desiredState: "d" }, successCriteria: [{ result: null, evidence: null }] });
    expect(unmetKeys(2, s)).toEqual(["notes", "meeting"]);
    s.documents = [{ type: "DISCOVERY_NOTES" }];
    s.activities = [{ type: "CALL" }];
    expect(unmetKeys(2, s)).toEqual(["meeting"]);
    s.activities.push({ type: "MEETING" });
    expect(unmetKeys(2, s)).toEqual([]);
  });

  it("stage 3 needs a complete scorecard and a recorded Go decision", () => {
    expect(unmetKeys(3, snap({ scorecard: card("GREEN", { TIMELINE: "UNKNOWN" }) }))).toEqual(["scorecard", "decision", "go"]);
    expect(unmetKeys(3, snap({ scorecard: {} }))).toContain("scorecard");
    const ok = snap({ scorecard: card("YELLOW"), fields: { goDecision: "GO", goRationale: "fits" } });
    expect(unmetKeys(3, ok)).toEqual([]);
    expect(unmetKeys(3, snap({ scorecard: card("RED"), fields: { goDecision: "NO_GO", goRationale: "no funding" } }))).toEqual(["go"]);
  });

  it("stage 4 needs every requirement tagged", () => {
    const fields = Object.fromEntries(
      ["designCapabilities", "designServices", "designData", "designIntegrations", "designConsulting", "designApproach"].map((f) => [f, "x"]),
    );
    expect(unmetKeys(4, snap({ fields }))).toEqual(["reqs"]);
    expect(unmetKeys(4, snap({ fields, requirements: [{ tag: "CONFIGURATION" }, { tag: null }] }))).toEqual(["tags"]);
    expect(unmetKeys(4, snap({ fields, requirements: [{ tag: "CONFIGURATION" }] }))).toEqual([]);
  });

  it("stage 5 only asks for environment details on branch C", () => {
    expect(unmetKeys(5, snap())).toEqual(["branch"]);
    expect(unmetKeys(5, snap({ fields: { branch: "B" } }))).toEqual([]);
    expect(unmetKeys(5, snap({ fields: { branch: "C" } }))).toEqual(["branchC"]);
    expect(unmetKeys(5, snap({ fields: { branch: "C", envSubType: "GOV_CLOUD", impactLevel: "IL4", atoStatus: "In progress" } }))).toEqual([]);
  });

  it("stage 6 needs a problem-focused demo", () => {
    expect(unmetKeys(6, snap({ activities: [{ type: "DEMO", problemFocused: false }] }))).toEqual(["demo"]);
    expect(unmetKeys(6, snap({ activities: [{ type: "DEMO", problemFocused: true }] }))).toEqual([]);
  });

  it("stage 8 needs quoted TCV and a license count, except for services-only deals", () => {
    const scope = Object.fromEntries(
      ["scopeSoftware", "scopeUsers", "scopeData", "scopeIntegrations", "scopeServices", "scopeInfrastructure", "scopeImplementation", "scopeSupport"].map((f) => [f, "x"]),
    );
    expect(unmetKeys(8, snap({ fields: { ...scope, tcvFlag: "ESTIMATE", engagementType: "DIRECT" } }))).toEqual(["licenses", "quoted"]);
    expect(unmetKeys(8, snap({ fields: { ...scope, tcvFlag: "QUOTED", engagementType: "DIRECT", licenseCount: 0 } }))).toEqual([]);
    expect(unmetKeys(8, snap({ fields: { ...scope, tcvFlag: "QUOTED", engagementType: "LE_SERVICES" } }))).toEqual([]);
  });

  it("stage 11 needs every success criterion evaluated with evidence", () => {
    expect(unmetKeys(11, snap())).toEqual(["outcomes"]);
    expect(unmetKeys(11, snap({ successCriteria: [{ result: "MET", evidence: "" }] }))).toEqual(["outcomes"]);
    expect(unmetKeys(11, snap({ successCriteria: [{ result: "PARTIALLY", evidence: "report" }] }))).toEqual([]);
  });

  it("unknown rule types fail closed", () => {
    const bad = { number: 1, name: "x", gate: [{ key: "k", label: "l", type: "nope" }] } as unknown as StageDef;
    expect(evaluateGate(bad, snap())[0].met).toBe(false);
  });
});

describe("planMove", () => {
  it("allows backward moves without gate checks", () => {
    expect(planMove(stages, snap({ stage: 5 }), 2)).toEqual({ direction: "backward", unmet: [], statusAfter: null });
  });
  it("reopens a won deal moved back to Contract or earlier", () => {
    expect(planMove(stages, snap({ stage: 11, status: "WON" }), 9).statusAfter).toBe("OPEN");
    expect(planMove(stages, snap({ stage: 11, status: "WON" }), 10).statusAfter).toBeNull();
  });
  it("reports no-op and rejects unknown stages", () => {
    expect(planMove(stages, snap({ stage: 3 }), 3).direction).toBe("none");
    expect(() => planMove(stages, snap(), 13)).toThrow();
  });
  it("checks every gate crossed when skipping stages", () => {
    const p = planMove(stages, snap({ stage: 1 }), 4);
    expect(p.direction).toBe("forward");
    expect(p.unmet.map((u) => u.stage)).toEqual([1, 2, 3]);
  });
  it("only checks the gates between current and target", () => {
    const s = snap({ stage: 6, activities: [{ type: "DEMO", problemFocused: true }] });
    expect(planMove(stages, s, 7).unmet).toEqual([]);
  });
  it("sets status to WON when leaving Contract", () => {
    const s = snap({ stage: 9, fields: { contractSubStatus: "AWARD", tcvFlag: "CONTRACTED" } });
    expect(planMove(stages, s, 10)).toEqual({ direction: "forward", unmet: [], statusAfter: "WON" });
    expect(planMove(stages, snap({ stage: 9, fields: { contractSubStatus: "NEGOTIATION", tcvFlag: "QUOTED" } }), 10).unmet[0].items).toHaveLength(2);
  });
});

describe("confidence tier", () => {
  it("is Early in stages 1-2 regardless of scorecard", () => {
    expect(confidenceTier(1, card("GREEN"), cfg)).toBe("Early");
    expect(confidenceTier(2, card("GREEN"), cfg)).toBe("Early");
  });
  it("is Possible from stage 3", () => {
    expect(confidenceTier(3, card("GREEN"), cfg)).toBe("Possible");
    expect(confidenceTier(5, card("RED"), cfg)).toBe("Possible");
  });
  it("is Probable at stage >= 6 with at most one red and Funding not red", () => {
    expect(confidenceTier(6, card("YELLOW"), cfg)).toBe("Probable");
    expect(confidenceTier(7, card("GREEN", { TIMELINE: "RED" }), cfg)).toBe("Probable");
    expect(confidenceTier(7, card("GREEN", { TIMELINE: "RED", CHAMPION: "RED" }), cfg)).toBe("Possible");
    expect(confidenceTier(7, card("GREEN", { FUNDING: "RED" }), cfg)).toBe("Possible");
  });
  it("is Committed at stage >= 9 only with Funding and Procurement path green", () => {
    expect(confidenceTier(9, card("YELLOW", { FUNDING: "GREEN", PROCUREMENT_PATH: "GREEN" }), cfg)).toBe("Committed");
    expect(confidenceTier(9, card("GREEN", { PROCUREMENT_PATH: "YELLOW" }), cfg)).toBe("Probable");
    expect(confidenceTier(8, card("GREEN"), cfg)).toBe("Probable");
  });
  it("treats missing ratings as unknown", () => {
    expect(confidenceTier(9, {}, cfg)).toBe("Probable");
  });
});

describe("award window", () => {
  const stored = { awardQuarter: 3, awardFy: 2027 };
  it("is unlocked only when Funding and Procurement path are green", () => {
    expect(awardWindowUnlocked(card("GREEN"), cfg)).toBe(true);
    expect(awardWindowUnlocked(card("GREEN", { FUNDING: "YELLOW" }), cfg)).toBe(false);
    expect(awardWindowUnlocked({}, cfg)).toBe(false);
  });
  it("keeps the stored value but reports untimed while locked", () => {
    expect(formatAwardWindow(effectiveAwardWindow(stored, card("GREEN"), cfg))).toBe("Q3 FY27");
    expect(formatAwardWindow(effectiveAwardWindow(stored, card("GREEN", { PROCUREMENT_PATH: "RED" }), cfg))).toBe("Untimed");
    expect(effectiveAwardWindow({ awardQuarter: null, awardFy: null }, card("GREEN"), cfg)).toBeNull();
  });
  it("uses the US federal fiscal year", () => {
    expect(fiscalQuarter(new Date("2026-10-01T00:00:00Z"))).toEqual({ quarter: 1, fy: 2027 });
    expect(fiscalQuarter(new Date("2026-09-30T00:00:00Z"))).toEqual({ quarter: 4, fy: 2026 });
    expect(fiscalQuarter(new Date("2027-01-15T00:00:00Z"))).toEqual({ quarter: 2, fy: 2027 });
    expect(fiscalQuarter(new Date("2027-05-15T00:00:00Z"))).toEqual({ quarter: 3, fy: 2027 });
  });
});

describe("stale ratings", () => {
  const now = new Date("2026-11-11T00:00:00Z");
  it("flags ratings older than the window", () => {
    expect(isStale(new Date("2026-08-01T00:00:00Z"), 90, now)).toBe(true);
    expect(isStale(new Date("2026-09-01T00:00:00Z"), 90, now)).toBe(false);
    expect(isStale(null, 90, now)).toBe(false);
  });
  it("ignores unknown ratings", () => {
    const old = new Date("2026-01-01T00:00:00Z");
    const sc: Scorecard = { FUNDING: { rating: "GREEN", updatedAt: old }, TIMELINE: { rating: "UNKNOWN", updatedAt: old } };
    expect(staleCriteria(sc, 90, now)).toEqual(["FUNDING"]);
  });
});

describe("forecast summary", () => {
  it("totals TCV by stage and splits timed vs untimed", () => {
    const s = summarize([
      { stage: 3, tcv: 100, timed: false, tier: "Possible" },
      { stage: 3, tcv: 50, timed: true, tier: "Possible" },
      { stage: 9, tcv: 400, timed: true, tier: "Committed" },
    ]);
    expect(s.byStage[3]).toEqual({ count: 2, tcv: 150, timed: 50, untimed: 100 });
    expect(s.total).toBe(550);
    expect(s.timed).toBe(450);
    expect(s.untimed).toBe(100);
    expect(s.byTier.Committed).toEqual({ count: 1, tcv: 400 });
  });
});
