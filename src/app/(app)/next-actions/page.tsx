import Link from "next/link";
import { Dots, ErrorBanner, PageHeader } from "@/components/ui";
import { date, daysSince, money, userName } from "@/lib/format";
import { CRITERION_LABEL } from "@/lib/labels";
import { getPipelineConfig, getStages } from "@/server/config";
import { db } from "@/server/db";
import { listOpportunities } from "@/server/queries";
import { requireUser } from "@/server/session";
import { toggleTask } from "../actions";

export default async function NextActionsPage({ searchParams }: { searchParams: Promise<{ who?: string; error?: string }> }) {
  const user = await requireUser();
  const { who, error } = await searchParams;
  const all = who === "all";
  const [cfg, stages] = await Promise.all([getPipelineConfig(), getStages()]);
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - cfg.staleDealDays * 86_400_000);
  const renewalCutoff = new Date(now.getTime() + cfg.renewalWindowDays * 86_400_000);

  const [tasks, opps, renewals] = await Promise.all([
    db.task.findMany({
      where: { done: false, ...(all ? {} : { assigneeId: user.id }) },
      include: { opportunity: { include: { organization: true } }, contact: true, assignee: true },
      // Overdue first: earliest due date at the top, undated last.
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    }),
    listOpportunities({ status: "OPEN", ...(all ? {} : { owner: user.id }) }),
    db.license.findMany({
      where: { status: { not: "LAPSED" }, renewalDate: { lte: renewalCutoff } },
      include: { customerOrg: true, opportunity: true }, orderBy: { renewalDate: "asc" },
    }),
  ]);
  const stageName = (n: number) => stages.find((s) => s.number === n)?.name ?? "";
  // A deal is stale when nothing has touched it (or, if never touched, since it was created) within the window.
  const staleDeals = opps.filter((o) => (o.lastTouchAt ?? o.createdAt) < staleCutoff);
  const staleCards = opps.filter((o) => o.staleRatings.length > 0);
  const noNext = opps.filter((o) => !o.nextAction);
  const back = all ? "/next-actions?who=all" : "/next-actions";

  const OppLine = ({ o, children }: { o: (typeof opps)[number]; children?: React.ReactNode }) => (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2">
      <div>
        <Link href={`/opportunities/${o.id}`} className="font-medium">{o.name}</Link>
        <div className="text-xs text-slate-500">{o.organization?.name ?? "No organization"} · {o.stage}. {stageName(o.stage)} · {money(o.tcv)}{all ? ` · ${userName(o.owner)}` : ""}</div>
      </div>
      <div className="text-right text-sm text-slate-600">{children}</div>
    </li>
  );
  const Empty = ({ children }: { children: React.ReactNode }) => <li className="muted py-2">{children}</li>;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Next actions & stale deals" sub={all ? "Everyone’s work" : "Your tasks and opportunities"}>
        <Link className="btn" href={all ? "/next-actions" : "/next-actions?who=all"}>{all ? "Show mine" : "Show everyone"}</Link>
        <Link className="btn" href={`/api/export/tasks${all ? "?who=all" : ""}`} prefetch={false}>Export tasks CSV</Link>
      </PageHeader>
      <ErrorBanner error={error} />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card lg:row-span-2" aria-labelledby="h-tasks">
          <h2 id="h-tasks">Open tasks ({tasks.length})</h2>
          <ul className="mt-2 divide-y divide-slate-200">
            {tasks.map((t) => {
              const overdue = t.dueDate && t.dueDate < now;
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <span className="font-medium">{t.title}</span>{" "}
                    {t.isPrimary && <span className="chip border-brand-100 bg-brand-50 text-brand-700">Next action</span>}
                    <div className="text-xs text-slate-500">
                      <span className={overdue ? "font-semibold text-red-700" : ""}>{t.dueDate ? `${overdue ? "Overdue · " : "Due "}${date(t.dueDate)}` : "No due date"}</span>
                      {t.opportunity && <> · <Link href={`/opportunities/${t.opportunity.id}`}>{t.opportunity.name}</Link></>}
                      {all && ` · ${userName(t.assignee)}`}
                    </div>
                  </div>
                  <form action={toggleTask}><input type="hidden" name="back" value={back} /><input type="hidden" name="taskId" value={t.id} />
                    <button className="btn btn-sm">Mark done</button></form>
                </li>
              );
            })}
            {!tasks.length && <Empty>No open tasks.</Empty>}
          </ul>
        </section>

        <section className="card" aria-labelledby="h-stale">
          <h2 id="h-stale">No email or meeting in over {cfg.staleDealDays} days ({staleDeals.length})</h2>
          <ul className="mt-2 divide-y divide-slate-200">
            {staleDeals.map((o) => <OppLine key={o.id} o={o}>{o.lastTouchAt ? `${daysSince(o.lastTouchAt)} days since last touch` : "Never touched"}</OppLine>)}
            {!staleDeals.length && <Empty>Every open deal has recent activity.</Empty>}
          </ul>
        </section>

        <section className="card" aria-labelledby="h-nonext">
          <h2 id="h-nonext">Missing a next action ({noNext.length})</h2>
          <ul className="mt-2 divide-y divide-slate-200">
            {noNext.map((o) => <OppLine key={o.id} o={o}><Link href={`/opportunities/${o.id}?tab=tasks`}>Add next action</Link></OppLine>)}
            {!noNext.length && <Empty>Every open deal has a next action.</Empty>}
          </ul>
        </section>

        <section className="card" aria-labelledby="h-score">
          <h2 id="h-score">Stale scorecard ratings ({staleCards.length})</h2>
          <ul className="mt-2 divide-y divide-slate-200">
            {staleCards.map((o) => (
              <OppLine key={o.id} o={o}>
                <Dots scorecard={o.scorecardMap} staleDays={cfg.scorecardStaleDays} />
                <div className="text-xs">{o.staleRatings.map((c) => CRITERION_LABEL[c]).join(", ")}</div>
              </OppLine>
            ))}
            {!staleCards.length && <Empty>No ratings older than {cfg.scorecardStaleDays} days.</Empty>}
          </ul>
        </section>

        <section className="card" aria-labelledby="h-renew">
          <h2 id="h-renew">Renewals due in {cfg.renewalWindowDays} days ({renewals.length})</h2>
          <ul className="mt-2 divide-y divide-slate-200">
            {renewals.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 py-2">
                <div><Link href={`/organizations/${l.customerOrgId}`} className="font-medium">{l.customerOrg.name}</Link>
                  <div className="text-xs text-slate-500">{l.licenseCount ?? "—"} licenses · {money(l.value)}</div></div>
                <span className="text-sm">{date(l.renewalDate)}</span>
              </li>
            ))}
            {!renewals.length && <Empty>No renewals coming up. License records arrive with Phase 5.</Empty>}
          </ul>
        </section>
      </div>
    </div>
  );
}
