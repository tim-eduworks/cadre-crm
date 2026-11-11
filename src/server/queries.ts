import type { Branch, Market, OppStatus, Prisma } from "@prisma/client";
import { confidenceTier, effectiveAwardWindow, formatAwardWindow, staleCriteria } from "@/domain/scorecard";
import { getPipelineConfig } from "./config";
import { db } from "./db";
import { toScorecard } from "./opportunities";

export type BoardFilters = {
  owner?: string; branch?: string; market?: string; tier?: string; timing?: string; status?: string;
};
const STATUSES = ["OPEN", "ON_HOLD", "WON", "LOST", "NO_BID"];
export const DEFAULT_STATUSES = ["OPEN", "ON_HOLD", "WON"];

/** Opportunities for the board / list / CSV, with derived tier and timed/untimed applied. */
export async function listOpportunities(f: BoardFilters = {}) {
  const cfg = await getPipelineConfig();
  const statuses = f.status === "ALL" ? STATUSES : f.status && STATUSES.includes(f.status) ? [f.status] : DEFAULT_STATUSES;
  const where: Prisma.OpportunityWhereInput = {
    status: { in: statuses as OppStatus[] },
    ...(f.owner ? { ownerId: f.owner } : {}),
    ...(f.branch && ["A", "B", "C"].includes(f.branch) ? { branch: f.branch as Branch } : {}),
    ...(f.market ? { organization: { market: f.market as Market } } : {}),
  };
  const rows = await db.opportunity.findMany({
    where,
    include: {
      organization: { select: { id: true, name: true, market: true } },
      owner: { select: { id: true, name: true, email: true } },
      scorecard: true,
      tasks: { where: { isPrimary: true, done: false }, take: 1, orderBy: { createdAt: "desc" }, include: { assignee: { select: { name: true, email: true } } } },
    },
    orderBy: [{ stage: "asc" }, { tcv: "desc" }],
  });
  return rows
    .map((o) => {
      const scorecard = toScorecard(o.scorecard);
      const window = effectiveAwardWindow(o, scorecard, cfg);
      return {
        ...o,
        tcvNumber: Number(o.tcv),
        scorecardMap: scorecard,
        tier: confidenceTier(o.stage, scorecard, cfg),
        timed: window !== null,
        awardWindow: formatAwardWindow(window),
        staleRatings: staleCriteria(scorecard, cfg.scorecardStaleDays),
        nextAction: o.tasks[0] ?? null,
      };
    })
    .filter((o) => (!f.tier || o.tier === f.tier) && (!f.timing || (f.timing === "timed") === o.timed));
}
export type OppRow = Awaited<ReturnType<typeof listOpportunities>>[number];

export async function userOptions() {
  const users = await db.user.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  return users.map((u) => ({ id: u.id, label: u.name || u.email }));
}
export async function orgOptions() {
  const orgs = await db.organization.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  return orgs.map((o) => ({ id: o.id, label: o.name }));
}
export async function vehicleOptions() {
  const v = await db.contractVehicle.findMany({ select: { id: true, name: true, number: true }, orderBy: { name: "asc" } });
  return v.map((x) => ({ id: x.id, label: x.number ? `${x.name} (${x.number})` : x.name }));
}

/** IDs of an org and all of its descendants (account roll-up). */
export async function orgTreeIds(rootId: string): Promise<string[]> {
  const all = await db.organization.findMany({ select: { id: true, parentId: true } });
  const kids = new Map<string, string[]>();
  for (const o of all) if (o.parentId) kids.set(o.parentId, [...(kids.get(o.parentId) ?? []), o.id]);
  const out: string[] = [];
  const seen = new Set<string>();
  const walk = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push(id);
    for (const k of kids.get(id) ?? []) walk(k);
  };
  walk(rootId);
  return out;
}
