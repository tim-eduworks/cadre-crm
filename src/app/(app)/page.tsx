import Link from "next/link";
import { Board, type BoardColumn } from "@/components/board";
import { PageHeader } from "@/components/ui";
import { summarize } from "@/domain/forecast";
import { ratingOf } from "@/domain/scorecard";
import { CRITERIA } from "@/domain/types";
import { daysSince, initials, moneyShort, userName } from "@/lib/format";
import { CRITERION_LABEL, L } from "@/lib/labels";
import { getPipelineConfig, getStages } from "@/server/config";
import { listOpportunities, userOptions, type BoardFilters } from "@/server/queries";
import { requireUser } from "@/server/session";

export default async function PipelinePage({ searchParams }: { searchParams: Promise<BoardFilters> }) {
  const user = await requireUser();
  const f = await searchParams;
  const [opps, stages, cfg, users] = await Promise.all([listOpportunities(f), getStages(), getPipelineConfig(), userOptions()]);
  const sum = summarize(opps.map((o) => ({ stage: o.stage, tcv: o.tcvNumber, timed: o.timed, tier: o.tier })));

  const columns: BoardColumn[] = stages.map((s) => ({
    number: s.number,
    name: s.name,
    total: moneyShort(sum.byStage[s.number]?.tcv ?? 0),
    timed: moneyShort(sum.byStage[s.number]?.timed ?? 0),
    untimed: moneyShort(sum.byStage[s.number]?.untimed ?? 0),
    cards: opps
      .filter((o) => o.stage === s.number)
      .map((o) => ({
        id: o.id,
        name: o.name,
        org: o.organization?.name ?? null,
        stage: o.stage,
        status: o.status,
        holdReason: o.holdReason,
        tcv: moneyShort(o.tcvNumber),
        tcvFlag: L.tcvFlag[o.tcvFlag],
        branch: o.branch,
        tier: o.tier,
        awardWindow: o.awardWindow,
        owner: userName(o.owner),
        ownerInitials: initials(userName(o.owner)),
        touchDays: daysSince(o.lastTouchAt),
        dots: CRITERIA.map((c) => ({ label: CRITERION_LABEL[c], rating: ratingOf(o.scorecardMap, c), stale: o.staleRatings.includes(c) })),
      })),
  }));

  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => typeof v === "string" && v) as [string, string][]).toString();
  const sel = (name: keyof BoardFilters, labelText: string, options: [string, string][], all = "All") => (
    <div>
      <label htmlFor={`f-${name}`}>{labelText}</label>
      <select id={`f-${name}`} name={name} defaultValue={f[name] ?? ""} className="!w-auto">
        <option value="">{all}</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );

  return (
    <>
      <PageHeader title="Pipeline">
        <Link className="btn" href={`/api/export/opportunities${qs ? `?${qs}` : ""}`} prefetch={false}>Export CSV</Link>
        <Link className="btn btn-primary" href="/opportunities/new">New opportunity</Link>
      </PageHeader>

      <div className="card mb-3 flex flex-wrap items-end justify-between gap-4">
        <form className="flex flex-wrap items-end gap-3">
          {sel("owner", "Owner", users.map((u) => [u.id, u.id === user.id ? `${u.label} (me)` : u.label]))}
          {sel("branch", "Branch", [["A", "A"], ["B", "B"], ["C", "C"]])}
          {sel("market", "Market", Object.entries(L.market))}
          {sel("tier", "Confidence tier", cfg.tiers.map((t) => [t.name, t.name]))}
          {sel("timing", "Award window", [["timed", "Timed"], ["untimed", "Untimed"]])}
          {sel("status", "Status", [...Object.entries(L.status), ["ALL", "All statuses"]], "Open, on hold, won")}
          <button className="btn">Apply</button>
          {qs && <Link href="/" className="pb-1.5 text-sm">Clear</Link>}
        </form>
        <dl className="flex gap-6 text-right" data-testid="summary">
          <div><dt className="text-xs text-slate-500">Total TCV · {opps.length} deals</dt><dd className="text-lg font-semibold">{moneyShort(sum.total)}</dd></div>
          <div><dt className="text-xs text-slate-500">Timed</dt><dd className="text-lg font-semibold">{moneyShort(sum.timed)}</dd></div>
          <div><dt className="text-xs text-slate-500">Untimed</dt><dd className="text-lg font-semibold">{moneyShort(sum.untimed)}</dd></div>
        </dl>
      </div>

      <Board columns={columns} isAdmin={user.role === "ADMIN"} />
    </>
  );
}
