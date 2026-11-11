import Link from "next/link";
import { notFound } from "next/navigation";
import { Dots, ErrorBanner, FieldInput, StatusChip, TierChip, type Option } from "@/components/ui";
import { evaluateGate } from "@/domain/gates";
import { awardWindowUnlocked, confidenceTier, effectiveAwardWindow, formatAwardWindow, isStale, ratingOf } from "@/domain/scorecard";
import { CRITERIA } from "@/domain/types";
import { date, dateInput, money, personName, userName } from "@/lib/format";
import { CRITERION_LABEL, L, label } from "@/lib/labels";
import { SECTIONS, type FieldDef, type SectionKey } from "@/lib/opportunity-fields";
import { getPipelineConfig, getStages } from "@/server/config";
import { db } from "@/server/db";
import { toSnapshot } from "@/server/opportunities";
import { orgOptions, userOptions, vehicleOptions } from "@/server/queries";
import { requireUser } from "@/server/session";
import {
  logActivity, moveStageAction, removeCriterion, removeDocument, removePartner, removeRequirement, removeStakeholder, removeTeamMember,
  saveAward, saveCriterion, saveDocument, savePartner, saveRequirement, saveScorecardAction, saveSection, saveStakeholder, saveStatus,
  saveTask, saveTeamMember, toggleTask,
} from "../../actions";

const TABS = [["overview", "Overview"], ["stakeholders", "Stakeholders"], ["activity", "Activity"], ["tasks", "Tasks"], ["documents", "Documents"], ["history", "History"]] as const;

export default async function OpportunityPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { tab: rawTab, error } = await searchParams;
  const tab = TABS.some(([t]) => t === rawTab) ? rawTab! : "overview";

  const opp = await db.opportunity.findUnique({
    where: { id },
    include: {
      organization: true, owner: true, deliveryOwner: true, contractVehicle: true,
      scorecard: true,
      successCriteria: { orderBy: { createdAt: "asc" } },
      requirements: { orderBy: { createdAt: "asc" } },
      documents: { orderBy: { createdAt: "desc" } },
      activities: { orderBy: { occurredAt: "desc" }, include: { participants: { include: { contact: true, user: true } }, createdBy: true } },
      stakeholders: { include: { contact: { include: { organization: true, emails: true } } } },
      teamMembers: { include: { user: true } },
      partners: { include: { organization: true } },
      tasks: { orderBy: [{ done: "asc" }, { dueDate: "asc" }], include: { assignee: true } },
      audit: { orderBy: { at: "desc" }, include: { user: true }, take: 300 },
      _count: { select: { stakeholders: true, licenses: true } },
    },
  });
  if (!opp) notFound();

  const [stages, cfg, users, orgs, vehicles] = await Promise.all([getStages(), getPipelineConfig(), userOptions(), orgOptions(), vehicleOptions()]);
  const snapshot = toSnapshot(opp);
  const sc = snapshot.scorecard;
  const stage = stages.find((s) => s.number === opp.stage);
  const gate = stage ? evaluateGate(stage, snapshot) : [];
  const gateMet = gate.every((g) => g.met);
  const next = stages.find((s) => s.number === opp.stage + 1);
  const tier = confidenceTier(opp.stage, sc, cfg);
  const unlocked = awardWindowUnlocked(sc, cfg);
  const window = effectiveAwardWindow(opp, sc, cfg);
  const closed = opp.status === "LOST" || opp.status === "NO_BID";
  const nextAction = opp.tasks.find((t) => t.isPrimary && !t.done);
  const base = `/opportunities/${opp.id}`;
  const back = tab === "overview" ? base : `${base}?tab=${tab}`;
  const isAdmin = user.role === "ADMIN";
  const today = new Date();

  const Hidden = ({ to = back }: { to?: string }) => (
    <>
      <input type="hidden" name="id" value={opp.id} />
      <input type="hidden" name="back" value={to} />
    </>
  );

  /** One editable block of opportunity fields. Open by default once the deal has reached that stage. */
  const Section = ({ k, title, atStage, fields, children, cols = 2 }: {
    k: SectionKey; title: string; atStage: number; fields?: FieldDef[]; children?: React.ReactNode; cols?: 1 | 2 | 3;
  }) => (
    <details className="card group" open={opp.stage >= atStage} id={k}>
      <summary className="flex cursor-pointer items-center justify-between gap-2 text-base font-semibold">
        <span>{title}</span>
        <span className="text-xs font-normal text-slate-500">{atStage > 0 ? `Stage ${atStage}` : ""}</span>
      </summary>
      <form action={saveSection} className="mt-3 space-y-3">
        <Hidden to={`${base}#${k}`} />
        <div className={`grid gap-3 ${cols === 1 ? "" : cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {(fields ?? SECTIONS[k]).map((def) => (
            <FieldInput key={def.name} def={def} value={(opp as Record<string, unknown>)[def.name]} users={users} orgs={orgs} vehicles={vehicles} />
          ))}
        </div>
        <div className="flex justify-end"><button className="btn btn-sm">Save {title.toLowerCase()}</button></div>
      </form>
      {children}
    </details>
  );

  const scopeFields = (SECTIONS.scope as FieldDef[]).filter((f) => f.name !== "licenseCount" || opp.engagementType !== "LE_SERVICES" || opp._count.licenses > 0);
  const deploymentFields = (SECTIONS.deployment as FieldDef[]).filter((f) => f.name === "branch" || opp.branch === "C");
  const valueFields = (SECTIONS.value as FieldDef[]).filter((f) => f.name !== "eduworksShare" || opp.engagementType === "VIA_PARTNER");
  const orgContacts: Option[] = opp.organizationId
    ? (await db.contact.findMany({
        where: { organizationId: { in: [opp.organizationId, ...opp.partners.map((p) => p.organizationId)] }, status: { not: "ARCHIVED" } },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }], take: 500,
      })).map((c) => ({ id: c.id, label: personName(c) + (c.title ? `, ${c.title}` : "") }))
    : [];
  const activityContacts: Option[] = opp.stakeholders.map((s) => ({ id: s.contactId, label: personName(s.contact) }));

  return (
    <div className="mx-auto max-w-6xl">
      <ErrorBanner error={error} />

      {/* ---------- Header ---------- */}
      <div className="card mb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm text-slate-500">
              {opp.organization ? <Link href={`/organizations/${opp.organization.id}`}>{opp.organization.name}</Link> : "No organization"}
              {" · "}{L.engagementType[opp.engagementType]}{" · Owner: "}{userName(opp.owner)}
            </div>
            <h1 className="mt-0.5">{opp.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="chip border-brand-100 bg-brand-50 text-brand-700" data-testid="stage-chip">Stage {opp.stage} · {stage?.name}</span>
              <StatusChip status={opp.status} />
              {(opp.holdReason || opp.closeReason) && <span className="text-sm text-slate-600">{opp.holdReason ?? opp.closeReason}</span>}
              <TierChip tier={tier} />
              {opp.branch && <span className="chip">Branch {opp.branch}</span>}
            </div>
          </div>
          <dl className="flex gap-6 text-right">
            <div>
              <dt className="text-xs text-slate-500">TCV ({L.tcvFlag[opp.tcvFlag].toLowerCase()})</dt>
              <dd className="text-lg font-semibold">{money(opp.tcv)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Award window</dt>
              <dd className="text-lg font-semibold">{formatAwardWindow(window)}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Dots scorecard={sc} staleDays={cfg.scorecardStaleDays} size="lg" />
          <a href="#scorecard" className="text-xs">Edit scorecard</a>
        </div>

        <ol className="mt-4 flex gap-1" aria-label="Pipeline stages">
          {stages.map((s) => (
            <li key={s.number} title={`${s.number}. ${s.name}`} aria-current={s.number === opp.stage ? "step" : undefined}
              className={`h-1.5 flex-1 rounded-full ${s.number < opp.stage ? "bg-brand-600" : s.number === opp.stage ? "bg-brand-700 ring-2 ring-brand-100" : "bg-slate-200"}`} />
          ))}
        </ol>

        <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4 lg:grid-cols-3">
          {/* Exit gate */}
          <div>
            <h2 className="text-sm">Exit criteria for {stage?.name}</h2>
            {gate.length === 0 ? <p className="muted mt-1 text-sm">Ongoing — no exit gate.</p> : (
              <ul className="mt-1 space-y-1 text-sm" data-testid="gate-checklist">
                {gate.map((g) => (
                  <li key={g.key} className="flex gap-2" data-met={g.met}>
                    <span aria-hidden className={g.met ? "text-green-700" : "text-slate-400"}>{g.met ? "✓" : "○"}</span>
                    <span className={g.met ? "text-slate-500" : ""}>{g.label}<span className="sr-only">{g.met ? " (met)" : " (not met)"}</span></span>
                  </li>
                ))}
              </ul>
            )}
            {next && !closed && (
              <form action={moveStageAction} className="mt-3">
                <Hidden />
                <input type="hidden" name="target" value={next.number} />
                <button className="btn btn-primary btn-sm" disabled={!gateMet} title={gateMet ? "" : "Exit criteria not met yet"}>Advance to {next.name}</button>
              </form>
            )}
          </div>

          {/* Move / override */}
          <div>
            <h2 className="text-sm">Move stage</h2>
            <form action={moveStageAction} className="mt-1 space-y-2">
              <Hidden />
              <label htmlFor="target" className="sr-only">Target stage</label>
              <select id="target" name="target" defaultValue={opp.stage} disabled={closed}>
                {stages.map((s) => <option key={s.number} value={s.number}>{s.number}. {s.name}{s.number === opp.stage ? " (current)" : ""}</option>)}
              </select>
              <label htmlFor="move-comment" className="sr-only">Reason or comment</label>
              <input id="move-comment" name="comment" type="text" placeholder="Reason (required to move back or override)" disabled={closed} />
              <div className="flex items-center justify-between gap-2">
                {isAdmin ? (
                  <label className="flex items-center gap-1.5 !text-xs"><input type="checkbox" name="override" value="1" /> Admin: override unmet gates</label>
                ) : <span />}
                <button className="btn btn-sm" disabled={closed}>Move</button>
              </div>
            </form>
          </div>

          {/* Status + next action */}
          <div>
            <h2 className="text-sm">Status</h2>
            <form action={saveStatus} className="mt-1 space-y-2">
              <Hidden />
              <label htmlFor="status" className="sr-only">Status</label>
              <select id="status" name="status" defaultValue={opp.status}>
                {Object.entries(L.status).filter(([k]) => k !== "WON" || opp.status === "WON").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <label htmlFor="status-reason" className="sr-only">Reason</label>
              <input id="status-reason" name="reason" type="text" defaultValue={opp.holdReason ?? opp.closeReason ?? ""} placeholder="Reason (on hold, lost, no-bid) e.g. awaiting funding, CR" />
              <div className="flex justify-end"><button className="btn btn-sm">Update status</button></div>
            </form>
            <div className="mt-3 text-sm">
              <span className="font-medium">Next action: </span>
              {nextAction ? (
                <span className={nextAction.dueDate && nextAction.dueDate < today ? "text-red-700" : ""}>
                  {nextAction.title} · due {date(nextAction.dueDate)} · {userName(nextAction.assignee)}
                </span>
              ) : opp.status === "OPEN" || opp.status === "ON_HOLD" ? (
                <Link href={`${base}?tab=tasks`} className="font-medium text-red-700">Missing — add one</Link>
              ) : <span className="muted">none</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Tabs ---------- */}
      <nav aria-label="Opportunity sections" className="mb-4 flex gap-1 border-b border-slate-200">
        {TABS.map(([t, text]) => (
          <Link key={t} href={t === "overview" ? base : `${base}?tab=${t}`} aria-current={t === tab ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium hover:no-underline ${t === tab ? "border-brand-700 text-brand-700" : "border-transparent text-slate-600 hover:text-slate-900"}`}>
            {text}
            {t === "stakeholders" && ` (${opp.stakeholders.length})`}
            {t === "tasks" && ` (${opp.tasks.filter((x) => !x.done).length})`}
          </Link>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <Section k="basics" title="Basics" atStage={0} />
            <details className="card" open id="value">
              <summary className="cursor-pointer text-base font-semibold">Value &amp; award window</summary>
              <form action={saveSection} className="mt-3 space-y-3">
                <Hidden to={`${base}#value`} />
                <div className="grid gap-3 sm:grid-cols-2">
                  {valueFields.map((def) => <FieldInput key={def.name} def={def} value={(opp as Record<string, unknown>)[def.name]} />)}
                  <div className="sm:col-span-2">
                    <label htmlFor="tcvComment">Comment on TCV change (logged)</label>
                    <input id="tcvComment" name="tcvComment" type="text" />
                  </div>
                </div>
                <div className="flex justify-end"><button className="btn btn-sm">Save value</button></div>
              </form>
              <form action={saveAward} className="mt-3 border-t border-slate-200 pt-3">
                <Hidden to={`${base}#value`} />
                <fieldset disabled={!unlocked} className="flex flex-wrap items-end gap-3">
                  <legend className="mb-1 text-xs font-medium text-slate-600">Award window</legend>
                  <div>
                    <label htmlFor="awardQuarter">Quarter</label>
                    <select id="awardQuarter" name="awardQuarter" defaultValue={opp.awardQuarter ?? ""} className="!w-24">
                      <option value="">—</option>{[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="awardFy">Fiscal year</label>
                    <input id="awardFy" name="awardFy" type="number" min={2020} max={2100} defaultValue={opp.awardFy ?? ""} placeholder="2027" className="!w-28" />
                  </div>
                  <button className="btn btn-sm">Save window</button>
                </fieldset>
                {!unlocked && (
                  <p className="mt-2 text-xs text-slate-600" data-testid="award-locked">
                    Untimed. The award window unlocks when <strong>Funding</strong> and <strong>Procurement path</strong> are both green.
                    {opp.awardQuarter && opp.awardFy ? ` (Saved value Q${opp.awardQuarter} FY${String(opp.awardFy).slice(-2)} is kept and will reappear.)` : ""}
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-500">US federal fiscal year: Q1 starts 1 October.</p>
              </form>
            </details>

            <details className="card" open id="scorecard">
              <summary className="cursor-pointer text-base font-semibold">Qualification scorecard</summary>
              <form action={saveScorecardAction} className="mt-3">
                <Hidden to={`${base}#scorecard`} />
                <table className="table">
                  <thead><tr><th>Criterion</th><th>Rating</th><th>Justification (one line)</th><th>Updated</th></tr></thead>
                  <tbody>
                    {CRITERIA.map((c) => {
                      const row = opp.scorecard.find((r) => r.criterion === c);
                      const r = ratingOf(sc, c);
                      const stale = r !== "UNKNOWN" && isStale(row?.updatedAt, cfg.scorecardStaleDays);
                      return (
                        <tr key={c}>
                          <td className="font-medium whitespace-nowrap"><label htmlFor={`rating_${c}`} className="!text-sm !text-slate-900">{CRITERION_LABEL[c]}</label></td>
                          <td>
                            <select id={`rating_${c}`} name={`rating_${c}`} defaultValue={r} className="!mt-0 !w-28">
                              {Object.entries(L.rating).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                          </td>
                          <td><input aria-label={`${CRITERION_LABEL[c]} justification`} name={`just_${c}`} type="text" defaultValue={row?.justification ?? ""} className="!mt-0" /></td>
                          <td className="text-xs whitespace-nowrap text-slate-500">
                            {r === "UNKNOWN" ? "—" : date(row?.updatedAt)}
                            {stale && (
                              <label className="mt-1 flex items-center gap-1 !text-xs !text-amber-800">
                                <input type="checkbox" name={`reviewed_${c}`} value="1" /> Stale — still accurate
                              </label>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Ratings older than {cfg.scorecardStaleDays} days show faded until reviewed.</span>
                  <button className="btn btn-sm">Save scorecard</button>
                </div>
              </form>
            </details>

            <Section k="qualification" title="Go / no-go" atStage={3} cols={1} />
            <Section k="procurement" title="Procurement & funding" atStage={3} />
            <Section k="deployment" title="Deployment" atStage={5} fields={deploymentFields}>
              {opp.branch !== "C" && <p className="mt-2 text-xs text-slate-500">Choosing branch C adds environment sub-type, impact level and ATO status.</p>}
            </Section>
          </div>

          <div className="space-y-4">
            <Section k="problem" title="Problem statement" atStage={1} cols={1} />

            <details className="card" open={opp.stage >= 2} id="criteria">
              <summary className="cursor-pointer text-base font-semibold">Success criteria</summary>
              <ul className="mt-3 space-y-3">
                {opp.successCriteria.map((c) => (
                  <li key={c.id} className="rounded-md border border-slate-200 p-2">
                    <form action={saveCriterion} className="grid gap-2 sm:grid-cols-3">
                      <Hidden to={`${base}#criteria`} /><input type="hidden" name="criterionId" value={c.id} />
                      <div className="sm:col-span-3"><input aria-label="Success criterion" name="text" type="text" defaultValue={c.text} className="!mt-0" /></div>
                      <select aria-label="Result" name="result" defaultValue={c.result ?? ""} className="!mt-0">
                        <option value="">Not evaluated</option>
                        {Object.entries(L.criterionResult).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      <input aria-label="Evidence" name="evidence" type="text" defaultValue={c.evidence ?? ""} placeholder="Evidence" className="!mt-0 sm:col-span-2" />
                      <div className="flex justify-end gap-2 sm:col-span-3">
                        <button className="btn btn-sm btn-danger" formAction={removeCriterion}>Remove</button>
                        <button className="btn btn-sm">Save</button>
                      </div>
                    </form>
                  </li>
                ))}
              </ul>
              <form action={saveCriterion} className="mt-3 flex gap-2">
                <Hidden to={`${base}#criteria`} />
                <input aria-label="New success criterion" name="text" type="text" placeholder="Add a success criterion" className="!mt-0" required />
                <button className="btn btn-sm">Add</button>
              </form>
            </details>

            <Section k="design" title="Solution design" atStage={4} cols={1}>
              <div className="mt-3 border-t border-slate-200 pt-3" id="requirements">
                <h3 className="text-sm font-semibold">Requirements</h3>
                <ul className="mt-2 space-y-2">
                  {opp.requirements.map((r) => (
                    <li key={r.id}>
                      <form action={saveRequirement} className="flex flex-wrap gap-2">
                        <Hidden to={`${base}#requirements`} /><input type="hidden" name="requirementId" value={r.id} />
                        <input aria-label="Requirement" name="text" type="text" defaultValue={r.text} className="!mt-0 min-w-40 flex-1" />
                        <select aria-label="Requirement tag" name="tag" defaultValue={r.tag ?? ""} className="!mt-0 !w-48">
                          <option value="">Untagged</option>
                          {Object.entries(L.requirementTag).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <button className="btn btn-sm">Save</button>
                        <button className="btn btn-sm btn-danger" formAction={removeRequirement}>Remove</button>
                      </form>
                    </li>
                  ))}
                </ul>
                <form action={saveRequirement} className="mt-2 flex flex-wrap gap-2">
                  <Hidden to={`${base}#requirements`} />
                  <input aria-label="New requirement" name="text" type="text" placeholder="Add a requirement" className="!mt-0 min-w-40 flex-1" required />
                  <select aria-label="New requirement tag" name="tag" defaultValue="" className="!mt-0 !w-48">
                    <option value="">Untagged</option>
                    {Object.entries(L.requirementTag).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <button className="btn btn-sm">Add</button>
                </form>
              </div>
            </Section>

            <Section k="validation" title="Validate value" atStage={7} cols={1} />
            <Section k="scope" title="Scope" atStage={8} fields={scopeFields} />
            <Section k="contract" title="Contract" atStage={9} cols={1} />
            <Section k="handoff" title="Implementation handoff" atStage={10} />
          </div>
        </div>
      )}

      {tab === "stakeholders" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card lg:col-span-2">
            <h2>Stakeholders</h2>
            <table className="table mt-2">
              <thead><tr><th>Contact</th><th>Roles</th><th /></tr></thead>
              <tbody>
                {opp.stakeholders.map((s) => (
                  <tr key={s.contactId}>
                    <td className="whitespace-nowrap">
                      <Link href={`/contacts/${s.contactId}`}>{personName(s.contact)}</Link>
                      <div className="text-xs text-slate-500">{[s.contact.title, s.contact.organization?.name].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td colSpan={2}>
                      <form action={saveStakeholder} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Hidden /><input type="hidden" name="contactId" value={s.contactId} />
                        {Object.entries(L.stakeholderRole).map(([k, v]) => (
                          <label key={k} className="flex items-center gap-1 !text-xs">
                            <input type="checkbox" name="roles" value={k} defaultChecked={s.roles.includes(k as never)} /> {v}
                          </label>
                        ))}
                        <span className="ml-auto flex gap-2">
                          <button className="btn btn-sm">Save roles</button>
                          <button className="btn btn-sm btn-danger" formAction={removeStakeholder}>Remove</button>
                        </span>
                      </form>
                    </td>
                  </tr>
                ))}
                {!opp.stakeholders.length && <tr><td colSpan={3} className="muted">No stakeholders yet. At least one contact is needed to leave stage 1.</td></tr>}
              </tbody>
            </table>
            <form action={saveStakeholder} className="mt-4 space-y-2 border-t border-slate-200 pt-3">
              <Hidden />
              <h3 className="text-sm font-semibold">Add stakeholder</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="sh-contact">Contact at {opp.organization?.name ?? "the customer"} or a partner</label>
                  <select id="sh-contact" name="contactId" defaultValue="">
                    <option value="">—</option>
                    {orgContacts.filter((c) => !opp.stakeholders.some((s) => s.contactId === c.id)).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="sh-email">…or any existing contact, by email</label>
                  <input id="sh-email" name="email" type="email" placeholder="name@example.mil" />
                </div>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {Object.entries(L.stakeholderRole).map(([k, v]) => (
                  <label key={k} className="flex items-center gap-1 !text-xs"><input type="checkbox" name="roles" value={k} /> {v}</label>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <Link href={`/contacts/new${opp.organizationId ? `?org=${opp.organizationId}` : ""}`} className="text-xs">Create a new contact</Link>
                <button className="btn btn-sm btn-primary">Add stakeholder</button>
              </div>
            </form>
          </div>

          <div className="card">
            <h2>Eduworks team</h2>
            <ul className="mt-2 divide-y divide-slate-200">
              <li className="flex items-center justify-between py-1.5"><span>{userName(opp.owner)}</span><span className="chip">Owner</span></li>
              {opp.teamMembers.map((m) => (
                <li key={m.userId} className="flex items-center justify-between gap-2 py-1.5">
                  <span>{userName(m.user)}</span>
                  <form action={removeTeamMember} className="flex items-center gap-2">
                    <Hidden /><input type="hidden" name="userId" value={m.userId} />
                    <span className="chip">{L.teamFunction[m.function]}</span>
                    <button className="btn btn-sm btn-danger" aria-label={`Remove ${userName(m.user)}`}>Remove</button>
                  </form>
                </li>
              ))}
            </ul>
            <form action={saveTeamMember} className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-200 pt-3">
              <Hidden />
              <div className="flex-1"><label htmlFor="tm-user">Team member</label>
                <select id="tm-user" name="userId">{users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</select></div>
              <div className="flex-1"><label htmlFor="tm-fn">Function</label>
                <select id="tm-fn" name="function">{Object.entries(L.teamFunction).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <button className="btn btn-sm">Add</button>
            </form>
          </div>

          <div className="card">
            <h2>Partners &amp; linked organizations</h2>
            <ul className="mt-2 divide-y divide-slate-200">
              {opp.partners.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-2 py-1.5">
                  <div>
                    <Link href={`/organizations/${p.organizationId}`}>{p.organization.name}</Link> <span className="chip">{L.partnerRole[p.role]}</span>
                    {p.customerContactOwner && <div className="text-xs text-slate-500">Talks to end customer: {p.customerContactOwner}</div>}
                    {p.notes && <div className="text-xs text-slate-500">{p.notes}</div>}
                  </div>
                  <form action={removePartner}><Hidden /><input type="hidden" name="partnerId" value={p.id} />
                    <button className="btn btn-sm btn-danger" aria-label={`Remove ${p.organization.name}`}>Remove</button></form>
                </li>
              ))}
              {!opp.partners.length && <li className="muted py-1.5">None. Add client-facing partners, white-label licensees, primes/subs or known end customers.</li>}
            </ul>
            <form action={savePartner} className="mt-3 grid gap-2 border-t border-slate-200 pt-3 sm:grid-cols-2">
              <Hidden />
              <div><label htmlFor="p-org">Organization</label>
                <select id="p-org" name="organizationId" defaultValue=""><option value="">—</option>{orgs.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></div>
              <div><label htmlFor="p-role">Role on this deal</label>
                <select id="p-role" name="role">{Object.entries(L.partnerRole).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div><label htmlFor="p-who">Who talks to the end customer</label><input id="p-who" name="customerContactOwner" type="text" /></div>
              <div><label htmlFor="p-notes">Notes</label><input id="p-notes" name="notes" type="text" /></div>
              <div className="flex justify-end sm:col-span-2"><button className="btn btn-sm">Add</button></div>
            </form>
          </div>
        </div>
      )}

      {tab === "activity" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <form action={logActivity} className="card space-y-3 self-start">
            <h2>Log activity</h2>
            <input type="hidden" name="back" value={back} /><input type="hidden" name="opportunityId" value={opp.id} />
            <div className="grid grid-cols-2 gap-3">
              <div><label htmlFor="a-type">Type</label>
                <select id="a-type" name="type" defaultValue="MEETING">{Object.entries(L.activityType).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div><label htmlFor="a-date">Date</label><input id="a-date" name="occurredAt" type="date" defaultValue={dateInput(today)} required /></div>
            </div>
            <div><label htmlFor="a-subject">Subject</label><input id="a-subject" name="subject" type="text" required /></div>
            <div><label htmlFor="a-notes">Notes (short)</label><textarea id="a-notes" name="snippet" rows={3} maxLength={2000} /></div>
            {activityContacts.length > 0 && (
              <fieldset><legend className="text-xs font-medium text-slate-600">Participants</legend>
                {activityContacts.map((c) => <label key={c.id} className="mt-1 flex items-center gap-1.5 !text-sm"><input type="checkbox" name="contactIds" value={c.id} /> {c.label}</label>)}
              </fieldset>
            )}
            <label className="flex items-start gap-1.5 !text-sm"><input type="checkbox" name="problemFocused" value="1" className="mt-0.5" /> Demo was problem-focused (tied to the problem statement)</label>
            <div className="flex justify-end"><button className="btn btn-primary btn-sm">Log activity</button></div>
            <p className="text-xs text-slate-500">Emails and meetings will log automatically once Google sync is connected (Phase 3).</p>
          </form>
          <div className="card lg:col-span-2">
            <h2>Timeline</h2>
            <ol className="mt-2 divide-y divide-slate-200">
              {opp.activities.map((a) => (
                <li key={a.id} className="py-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span><span className="chip">{L.activityType[a.type]}</span>{a.problemFocused && <span className="chip ml-1">Problem-focused</span>}{" "}
                      {a.link ? <a href={a.link} target="_blank" rel="noreferrer" className="font-medium">{a.subject}</a> : <span className="font-medium">{a.subject}</span>}</span>
                    <span className="text-xs text-slate-500">{date(a.occurredAt)}</span>
                  </div>
                  {a.snippet && <p className="mt-1 text-sm whitespace-pre-line text-slate-700">{a.snippet}</p>}
                  <p className="mt-1 text-xs text-slate-500">
                    {a.participants.map((p) => (p.contact ? personName(p.contact) : p.user ? userName(p.user) : "")).filter(Boolean).join(", ")}
                  </p>
                </li>
              ))}
              {!opp.activities.length && <li className="muted py-2">No activity yet.</li>}
            </ol>
          </div>
        </div>
      )}

      {tab === "tasks" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <form action={saveTask} className="card space-y-3 self-start">
            <h2>Add task</h2>
            <input type="hidden" name="back" value={back} /><input type="hidden" name="opportunityId" value={opp.id} />
            <div><label htmlFor="t-title">Task</label><input id="t-title" name="title" type="text" required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label htmlFor="t-due">Due</label><input id="t-due" name="dueDate" type="date" /></div>
              <div><label htmlFor="t-who">Assignee</label>
                <select id="t-who" name="assigneeId" defaultValue={user.id}>{users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</select></div>
            </div>
            <label className="flex items-center gap-1.5 !text-sm"><input type="checkbox" name="isPrimary" value="1" defaultChecked={!nextAction} /> Make this the next action</label>
            <div className="flex justify-end"><button className="btn btn-primary btn-sm">Add task</button></div>
          </form>
          <div className="card lg:col-span-2">
            <h2>Tasks</h2>
            <ul className="mt-2 divide-y divide-slate-200">
              {opp.tasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                  <div className={t.done ? "text-slate-400 line-through" : ""}>
                    {t.title} {t.isPrimary && !t.done && <span className="chip border-brand-100 bg-brand-50 text-brand-700">Next action</span>}
                    <div className={`text-xs ${!t.done && t.dueDate && t.dueDate < today ? "font-medium text-red-700" : "text-slate-500"}`}>
                      {t.dueDate ? `Due ${date(t.dueDate)}` : "No due date"} · {userName(t.assignee)}
                    </div>
                  </div>
                  <form action={toggleTask}><input type="hidden" name="back" value={back} /><input type="hidden" name="taskId" value={t.id} />
                    <button className="btn btn-sm">{t.done ? "Reopen" : "Mark done"}</button></form>
                </li>
              ))}
              {!opp.tasks.length && <li className="muted py-2">No tasks.</li>}
            </ul>
          </div>
        </div>
      )}

      {tab === "documents" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <form action={saveDocument} className="card space-y-3 self-start">
            <h2>Link a document</h2>
            <Hidden />
            <div><label htmlFor="d-type">Type</label>
              <select id="d-type" name="type" defaultValue="DISCOVERY_NOTES">{Object.entries(L.docType).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div><label htmlFor="d-title">Title</label><input id="d-title" name="title" type="text" /></div>
            <div><label htmlFor="d-url">Google Docs / Drive link</label><input id="d-url" name="url" type="url" required placeholder="https://docs.google.com/…" /></div>
            <div className="flex justify-end"><button className="btn btn-primary btn-sm">Link document</button></div>
          </form>
          <div className="card lg:col-span-2">
            <h2>Documents</h2>
            <p className="mt-1 text-sm text-slate-600">
              {opp.driveFolderUrl ? <a href={opp.driveFolderUrl} target="_blank" rel="noreferrer">Open Drive folder</a>
                : "The Drive folder, recent files and template generation arrive with Phase 4. For now, link existing docs here."}
            </p>
            <ul className="mt-2 divide-y divide-slate-200">
              {opp.documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                  <span><span className="chip">{L.docType[d.type]}</span> <a href={d.url} target="_blank" rel="noreferrer">{d.title}</a>
                    <span className="ml-2 text-xs text-slate-500">{date(d.createdAt)}</span></span>
                  <form action={removeDocument}><Hidden /><input type="hidden" name="documentId" value={d.id} />
                    <button className="btn btn-sm btn-danger" aria-label={`Unlink ${d.title}`}>Unlink</button></form>
                </li>
              ))}
              {!opp.documents.length && <li className="muted py-2">No documents linked.</li>}
            </ul>
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="card">
          <h2>History</h2>
          <p className="muted text-sm">Every stage, status, scorecard and TCV change.</p>
          <table className="table mt-2">
            <thead><tr><th>When</th><th>Who</th><th>Change</th><th>From</th><th>To</th><th>Comment</th></tr></thead>
            <tbody>
              {opp.audit.map((a) => {
                const fmt = (v: string | null) =>
                  !v ? "—" : a.kind === "TCV" && a.field === "tcv" ? money(v) : a.kind === "SCORECARD" ? label(L.rating, v) : a.kind === "STATUS" ? label(L.status, v) : a.field === "tcvFlag" ? label(L.tcvFlag, v) : v;
                return (
                  <tr key={a.id}>
                    <td className="text-xs whitespace-nowrap text-slate-500">{a.at.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC</td>
                    <td className="whitespace-nowrap">{a.user ? userName(a.user) : "—"}</td>
                    <td className="whitespace-nowrap">{L.auditKind[a.kind]}{a.kind === "SCORECARD" && a.field ? `: ${CRITERION_LABEL[a.field as keyof typeof CRITERION_LABEL] ?? a.field}` : a.field === "tcvFlag" ? " basis" : ""}</td>
                    <td>{fmt(a.oldValue)}</td>
                    <td>{fmt(a.newValue)}</td>
                    <td className="text-slate-600">{a.comment}</td>
                  </tr>
                );
              })}
              {!opp.audit.length && <tr><td colSpan={6} className="muted">No changes logged yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
