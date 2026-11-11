import { Prisma, type AuditKind, type OppStatus, type User } from "@prisma/client";
import { evaluateGate, planMove } from "@/domain/gates";
import { awardWindowUnlocked } from "@/domain/scorecard";
import { CRITERIA, type Criterion, type Rating, type Scorecard, type Snapshot } from "@/domain/types";
import { FIELD_BY_NAME } from "@/lib/opportunity-fields";
import { getPipelineConfig, getStages } from "./config";
import { db } from "./db";
import { AppError } from "./session";

type Tx = Prisma.TransactionClient;

export function audit(tx: Tx, opportunityId: string, userId: string, kind: AuditKind, data: { field?: string; oldValue?: string | null; newValue?: string | null; comment?: string | null }) {
  return tx.auditLog.create({ data: { opportunityId, userId, kind, ...data } });
}

const snapshotInclude = {
  scorecard: true,
  successCriteria: { orderBy: { createdAt: "asc" } },
  requirements: { orderBy: { createdAt: "asc" } },
  documents: true,
  activities: { select: { type: true, problemFocused: true } },
  _count: { select: { stakeholders: true, licenses: true } },
} satisfies Prisma.OpportunityInclude;

type OppForSnapshot = Prisma.OpportunityGetPayload<{ include: typeof snapshotInclude }>;

export function toScorecard(rows: { criterion: string; rating: string; updatedAt: Date }[]): Scorecard {
  const sc: Scorecard = {};
  for (const r of rows) sc[r.criterion as Criterion] = { rating: r.rating as Rating, updatedAt: r.updatedAt };
  return sc;
}

export function toSnapshot(o: OppForSnapshot): Snapshot {
  const { scorecard, successCriteria, requirements, documents, activities, _count, ...fields } = o;
  return {
    stage: o.stage,
    status: o.status,
    fields: fields as Record<string, unknown>,
    stakeholders: _count.stakeholders,
    licenses: _count.licenses,
    successCriteria,
    requirements,
    activities,
    documents,
    scorecard: toScorecard(scorecard),
  };
}

export async function loadSnapshot(id: string) {
  const opp = await db.opportunity.findUnique({ where: { id }, include: snapshotInclude });
  if (!opp) throw new AppError("Opportunity not found", 404);
  return { opp, snapshot: toSnapshot(opp) };
}

/** Exit-gate checklist for the opportunity's current stage. */
export async function currentGate(snapshot: Snapshot) {
  const stages = await getStages();
  const stage = stages.find((s) => s.number === snapshot.stage);
  return stage ? evaluateGate(stage, snapshot) : [];
}

export class GateError extends AppError {
  constructor(public unmet: { stage: number; name: string; items: string[] }[]) {
    super("Stage gate not met", 409, { unmet });
  }
}

/**
 * Move an opportunity to another stage. Forward moves must pass every gate crossed, unless an admin
 * overrides with a comment. Backward moves are always allowed but need a reason. Everything is logged.
 */
export async function moveStage(user: User, id: string, target: number, opts: { comment?: string; override?: boolean } = {}) {
  const [{ opp, snapshot }, stages] = await Promise.all([loadSnapshot(id), getStages()]);
  if (opp.status === "LOST" || opp.status === "NO_BID") throw new AppError("This opportunity is closed. Reopen it before changing its stage.");
  const plan = planMove(stages, snapshot, target);
  if (plan.direction === "none") return opp;
  const comment = opts.comment?.trim() || null;

  let overridden = false;
  if (plan.direction === "backward") {
    if (!comment) throw new AppError("A reason is required to move an opportunity backward.", 422);
  } else if (plan.unmet.length) {
    if (!opts.override) throw new GateError(plan.unmet);
    if (user.role !== "ADMIN") throw new AppError("Only admins can override a stage gate.", 403);
    if (!comment) throw new AppError("A comment is required to override a stage gate.", 422);
    overridden = true;
  }

  const name = (n: number) => `${n} ${stages.find((s) => s.number === n)?.name ?? ""}`.trim();
  const newStatus = plan.statusAfter && plan.statusAfter !== opp.status ? (plan.statusAfter as OppStatus) : null;
  return db.$transaction(async (tx) => {
    const updated = await tx.opportunity.update({
      where: { id },
      data: { stage: target, ...(newStatus ? { status: newStatus, holdReason: null } : {}) },
    });
    await audit(tx, id, user.id, "STAGE", { oldValue: name(opp.stage), newValue: name(target), comment });
    if (overridden) {
      const unmet = plan.unmet.map((u) => `${u.name}: ${u.items.join("; ")}`).join(" | ");
      await audit(tx, id, user.id, "GATE_OVERRIDE", { oldValue: unmet, newValue: "overridden", comment });
    }
    if (newStatus) {
      await audit(tx, id, user.id, "STATUS", { oldValue: opp.status, newValue: newStatus, comment: `Set by move to ${name(target)}` });
    }
    return updated;
  });
}

export async function setStatus(user: User, id: string, status: OppStatus, reason?: string) {
  const opp = await db.opportunity.findUnique({ where: { id } });
  if (!opp) throw new AppError("Opportunity not found", 404);
  const r = reason?.trim() || null;
  if (status === "WON" && opp.status !== "WON") throw new AppError("Won is set by completing the Contract stage gate.");
  if ((status === "ON_HOLD" || status === "LOST" || status === "NO_BID") && !r) throw new AppError("A reason is required for this status.", 422);
  if (status === opp.status && r === (opp.holdReason ?? opp.closeReason)) return opp;
  return db.$transaction(async (tx) => {
    const updated = await tx.opportunity.update({
      where: { id },
      data: {
        status,
        holdReason: status === "ON_HOLD" ? r : null,
        closeReason: status === "LOST" || status === "NO_BID" ? r : null,
      },
    });
    await audit(tx, id, user.id, "STATUS", { oldValue: opp.status, newValue: status, comment: r });
    return updated;
  });
}

export async function saveScorecard(user: User, id: string, ratings: { criterion: Criterion; rating: Rating; justification: string; reviewed?: boolean }[]) {
  const existing = await db.scorecardRating.findMany({ where: { opportunityId: id } });
  const byC = new Map(existing.map((r) => [r.criterion as Criterion, r]));
  await db.$transaction(async (tx) => {
    for (const r of ratings) {
      if (!CRITERIA.includes(r.criterion)) continue;
      const old = byC.get(r.criterion);
      const justification = r.justification.trim() || null;
      const ratingChanged = (old?.rating ?? "UNKNOWN") !== r.rating;
      const textChanged = (old?.justification ?? null) !== justification;
      if (!ratingChanged && !textChanged && !r.reviewed) continue;
      if (r.rating !== "UNKNOWN" && !justification) {
        throw new AppError(`Add a one-line justification for ${r.criterion.replace(/_/g, " ").toLowerCase()}.`, 422);
      }
      // Any change (or an explicit "still accurate" review) refreshes the last-updated date used for staleness.
      await tx.scorecardRating.upsert({
        where: { opportunityId_criterion: { opportunityId: id, criterion: r.criterion } },
        create: { opportunityId: id, criterion: r.criterion, rating: r.rating, justification, updatedAt: new Date() },
        update: { rating: r.rating, justification, updatedAt: new Date() },
      });
      if (ratingChanged || textChanged) {
        await audit(tx, id, user.id, "SCORECARD", {
          field: r.criterion, oldValue: old?.rating ?? "UNKNOWN", newValue: r.rating,
          comment: justification ?? (r.reviewed ? "Reviewed" : null),
        });
      } else {
        await audit(tx, id, user.id, "SCORECARD", { field: r.criterion, oldValue: r.rating, newValue: r.rating, comment: "Reviewed, still accurate" });
      }
    }
  });
}

function parseField(name: string, raw: string): unknown {
  const def = FIELD_BY_NAME.get(name);
  if (!def) throw new AppError(`Unknown field ${name}`);
  const v = raw.trim();
  if (!v) {
    if (def.required) throw new AppError(`${def.label} is required.`, 422);
    return null;
  }
  switch (def.kind) {
    case "int": {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0) throw new AppError(`${def.label} must be a whole number.`, 422);
      return n;
    }
    case "money": {
      const n = Number(v.replace(/[$,\s]/g, ""));
      if (!Number.isFinite(n) || n < 0) throw new AppError(`${def.label} must be a dollar amount.`, 422);
      return new Prisma.Decimal(n.toFixed(2));
    }
    case "date": {
      const d = new Date(`${v}T00:00:00Z`);
      if (Number.isNaN(d.getTime())) throw new AppError(`${def.label} is not a valid date.`, 422);
      return d;
    }
    case "enum":
      if (!def.options || !(v in def.options)) throw new AppError(`${def.label}: invalid choice.`, 422);
      return v;
    default:
      return v;
  }
}

/** Update whitelisted scalar fields. TCV and TCV-basis changes are audit-logged. */
export async function updateFields(user: User, id: string, input: Record<string, string>, comment?: string) {
  const opp = await db.opportunity.findUnique({ where: { id } });
  if (!opp) throw new AppError("Opportunity not found", 404);
  const data: Record<string, unknown> = {};
  for (const [k, raw] of Object.entries(input)) {
    if (FIELD_BY_NAME.has(k)) data[k] = parseField(k, raw);
  }
  if (!Object.keys(data).length) return opp;
  return db.$transaction(async (tx) => {
    const updated = await tx.opportunity.update({ where: { id }, data: data as Prisma.OpportunityUncheckedUpdateInput });
    if ("tcv" in data && !opp.tcv.equals(updated.tcv)) {
      await audit(tx, id, user.id, "TCV", { field: "tcv", oldValue: opp.tcv.toFixed(2), newValue: updated.tcv.toFixed(2), comment: comment?.trim() || null });
    }
    if ("tcvFlag" in data && opp.tcvFlag !== updated.tcvFlag) {
      await audit(tx, id, user.id, "TCV", { field: "tcvFlag", oldValue: opp.tcvFlag, newValue: updated.tcvFlag, comment: comment?.trim() || null });
    }
    return updated;
  });
}

/** Award window is only editable while Funding and Procurement path are green. */
export async function setAwardWindow(id: string, quarter: number | null, fy: number | null) {
  const [{ snapshot }, cfg] = await Promise.all([loadSnapshot(id), getPipelineConfig()]);
  if (!awardWindowUnlocked(snapshot.scorecard, cfg)) {
    throw new AppError("The award window can only be set when Funding and Procurement path are both green.", 409);
  }
  if (quarter === null || fy === null) return db.opportunity.update({ where: { id }, data: { awardQuarter: null, awardFy: null } });
  if (![1, 2, 3, 4].includes(quarter) || !Number.isInteger(fy) || fy < 2020 || fy > 2100) throw new AppError("Enter a quarter (1–4) and a four-digit fiscal year.", 422);
  return db.opportunity.update({ where: { id }, data: { awardQuarter: quarter, awardFy: fy } });
}

/** Mark a touch (manual activity now; Gmail/Calendar sync later) on the opportunity and its contacts. */
export async function recordTouch(tx: Tx, at: Date, opportunityId: string | null, contactIds: string[]) {
  if (at > new Date()) return;
  if (opportunityId) {
    await tx.opportunity.updateMany({ where: { id: opportunityId, OR: [{ lastTouchAt: null }, { lastTouchAt: { lt: at } }] }, data: { lastTouchAt: at } });
  }
  if (contactIds.length) {
    await tx.contact.updateMany({ where: { id: { in: contactIds }, OR: [{ lastTouchAt: null }, { lastTouchAt: { lt: at } }] }, data: { lastTouchAt: at } });
  }
}
