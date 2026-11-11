import Link from "next/link";
import { notFound } from "next/navigation";
import { OrgForm } from "@/components/org-form";
import { Timeline, timelineInclude } from "@/components/timeline";
import { ErrorBanner, PageHeader, StatusChip } from "@/components/ui";
import { date, money, personName } from "@/lib/format";
import { L } from "@/lib/labels";
import { getStages } from "@/server/config";
import { db } from "@/server/db";
import { orgOptions, orgTreeIds } from "@/server/queries";
import { requireUser } from "@/server/session";
import { removeAgreement, saveAgreement, saveOrganization } from "../../actions";

export default async function OrganizationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  await requireUser();
  const { id } = await params;
  const { error } = await searchParams;
  const org = await db.organization.findUnique({
    where: { id },
    include: { parent: { include: { parent: true } }, children: { orderBy: { name: "asc" } }, domains: true, agreements: { orderBy: { createdAt: "desc" } } },
  });
  if (!org) notFound();
  const tree = await orgTreeIds(id); // this org + all descendants: account views roll up children
  const [opps, partnerDeals, contacts, contactCount, activities, orgs, stages, unassigned] = await Promise.all([
    db.opportunity.findMany({ where: { organizationId: { in: tree } }, include: { organization: true }, orderBy: [{ status: "asc" }, { stage: "desc" }] }),
    db.opportunityPartner.findMany({ where: { organizationId: { in: tree } }, include: { opportunity: { include: { organization: true } }, organization: true } }),
    db.contact.findMany({ where: { organizationId: { in: tree } }, include: { emails: true, organization: true }, orderBy: [{ status: "asc" }, { lastName: "asc" }], take: 100 }),
    db.contact.count({ where: { organizationId: { in: tree } } }),
    db.activity.findMany({ where: { organizationId: { in: tree } }, include: timelineInclude, orderBy: { occurredAt: "desc" }, take: 50 }),
    orgOptions(), getStages(),
    db.activity.count({ where: { organizationId: { in: tree }, opportunityId: null, type: { in: ["EMAIL", "MEETING"] } } }),
  ]);
  const stageName = (n: number) => stages.find((s) => s.number === n)?.name ?? "";
  const chain = [org.parent?.parent, org.parent].filter(Boolean) as { id: string; name: string }[];
  const rolled = tree.length > 1;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={org.name}
        sub={<>
          {chain.map((p) => <span key={p.id}><Link href={`/organizations/${p.id}`}>{p.name}</Link> → </span>)}
          {L.orgType[org.type]}{org.market ? ` · ${L.market[org.market]}` : ""}
          {org.domains.length > 0 && ` · ${org.domains.map((d) => d.domain).join(", ")}`}
        </>}
      >
        <Link className="btn" href={`/contacts/new?org=${org.id}`}>New contact</Link>
        <Link className="btn btn-primary" href={`/opportunities/new?org=${org.id}`}>New opportunity</Link>
      </PageHeader>
      <ErrorBanner error={error} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="card">
            <h2>Opportunities{rolled && <span className="muted text-sm font-normal"> · includes {tree.length - 1} child organization{tree.length > 2 ? "s" : ""}</span>}</h2>
            <table className="table mt-2">
              <thead><tr><th>Opportunity</th><th>Stage</th><th>Status</th><th className="!text-right">TCV</th></tr></thead>
              <tbody>
                {opps.map((o) => (
                  <tr key={o.id}>
                    <td><Link href={`/opportunities/${o.id}`} className="font-medium">{o.name}</Link>
                      {o.organizationId !== org.id && <div className="text-xs text-slate-500">{o.organization?.name}</div>}</td>
                    <td>{o.stage}. {stageName(o.stage)}</td><td><StatusChip status={o.status} /></td><td className="text-right">{money(o.tcv)}</td>
                  </tr>
                ))}
                {partnerDeals.map((p) => (
                  <tr key={p.id}>
                    <td><Link href={`/opportunities/${p.opportunity.id}`} className="font-medium">{p.opportunity.name}</Link>
                      <div className="text-xs text-slate-500">as {L.partnerRole[p.role]} · customer: {p.opportunity.organization?.name ?? "—"}</div></td>
                    <td>{p.opportunity.stage}. {stageName(p.opportunity.stage)}</td><td><StatusChip status={p.opportunity.status} /></td>
                    <td className="text-right">{money(p.opportunity.tcv)}</td>
                  </tr>
                ))}
                {!opps.length && !partnerDeals.length && <tr><td colSpan={4} className="muted">No opportunities.</td></tr>}
              </tbody>
            </table>
            {unassigned > 0 && <p className="mt-2 text-sm text-amber-800">{unassigned} synced email/meeting activit{unassigned === 1 ? "y is" : "ies are"} not yet assigned to an opportunity.</p>}
          </section>

          <section className="card">
            <h2>Contacts ({contactCount})</h2>
            <table className="table mt-2">
              <thead><tr><th>Name</th><th>Title</th><th>Email</th><th>Status</th><th>Last touch</th></tr></thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id}>
                    <td><Link href={`/contacts/${c.id}`} className="font-medium">{personName(c)}</Link>
                      {c.organizationId !== org.id && <div className="text-xs text-slate-500">{c.organization?.name}</div>}</td>
                    <td>{c.title ?? "—"}</td><td>{c.emails.find((e) => e.isPrimary)?.email ?? c.emails[0]?.email ?? "—"}</td>
                    <td>{L.contactStatus[c.status]}</td><td>{date(c.lastTouchAt)}</td>
                  </tr>
                ))}
                {!contacts.length && <tr><td colSpan={5} className="muted">No contacts.</td></tr>}
              </tbody>
            </table>
            {contactCount > contacts.length && <p className="mt-2 text-sm"><Link href={`/contacts?q=${encodeURIComponent(org.name)}&status=ALL`}>See all {contactCount}</Link></p>}
          </section>

          <section className="card">
            <h2>Partner agreements</h2>
            <ul className="mt-2 divide-y divide-slate-200">
              {org.agreements.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 py-2">
                  <div className="text-sm">
                    <span className="font-medium">{L.agreementType[a.type]}</span> <span className="chip">{L.agreementStatus[a.status]}</span>
                    <div className="text-xs text-slate-500">
                      {[a.startDate || a.endDate ? `${date(a.startDate)} – ${date(a.endDate)}` : null, a.brandName && `Brand: ${a.brandName}`, a.territory && `Territory: ${a.territory}`,
                        a.pricingModel && `Pricing: ${L.pricingModel[a.pricingModel]}`, a.minimumCommitments && `Minimums: ${a.minimumCommitments}`,
                        a.endCustomers && `End customers: ${a.endCustomers}`, a.rateCard && `Rates: ${a.rateCard}`, a.ceiling && `Ceiling: ${money(a.ceiling)}`, a.notes,
                      ].filter(Boolean).join(" · ")}
                    </div>
                    {a.docUrl && <a href={a.docUrl} target="_blank" rel="noreferrer" className="text-xs">Agreement document</a>}
                  </div>
                  <form action={removeAgreement}><input type="hidden" name="organizationId" value={org.id} /><input type="hidden" name="agreementId" value={a.id} />
                    <button className="btn btn-sm btn-danger">Remove</button></form>
                </li>
              ))}
              {!org.agreements.length && <li className="muted py-2">No agreements.</li>}
            </ul>
            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-medium text-brand-600">Add agreement</summary>
              <form action={saveAgreement} className="mt-3 grid gap-3 sm:grid-cols-3">
                <input type="hidden" name="organizationId" value={org.id} />
                <div><label htmlFor="ag-type">Relationship</label><select id="ag-type" name="type">{Object.entries(L.agreementType).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                <div><label htmlFor="ag-status">Status</label><select id="ag-status" name="status">{Object.entries(L.agreementStatus).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                <div><label htmlFor="ag-doc">Drive doc link</label><input id="ag-doc" name="docUrl" type="url" /></div>
                <div><label htmlFor="ag-start">Start</label><input id="ag-start" name="startDate" type="date" /></div>
                <div><label htmlFor="ag-end">End</label><input id="ag-end" name="endDate" type="date" /></div>
                <div><label htmlFor="ag-notes">Notes</label><input id="ag-notes" name="notes" type="text" /></div>
                <fieldset className="grid gap-3 border-t border-slate-200 pt-2 sm:col-span-3 sm:grid-cols-3">
                  <legend className="text-xs font-semibold text-slate-500 uppercase">White-label</legend>
                  <div><label htmlFor="ag-brand">Licensed brand name</label><input id="ag-brand" name="brandName" type="text" /></div>
                  <div><label htmlFor="ag-terr">Territory / market</label><input id="ag-terr" name="territory" type="text" /></div>
                  <div><label htmlFor="ag-price">Pricing model</label><select id="ag-price" name="pricingModel" defaultValue=""><option value="">—</option>{Object.entries(L.pricingModel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                  <div><label htmlFor="ag-min">Minimum commitments</label><input id="ag-min" name="minimumCommitments" type="text" /></div>
                  <div className="sm:col-span-2"><label htmlFor="ag-cust">End customers sublicensed</label><input id="ag-cust" name="endCustomers" type="text" /></div>
                </fieldset>
                <fieldset className="grid gap-3 border-t border-slate-200 pt-2 sm:col-span-3 sm:grid-cols-3">
                  <legend className="text-xs font-semibold text-slate-500 uppercase">Services</legend>
                  <div className="sm:col-span-2"><label htmlFor="ag-rate">Labor categories or rate card link</label><input id="ag-rate" name="rateCard" type="text" /></div>
                  <div><label htmlFor="ag-ceil">Ceiling (USD)</label><input id="ag-ceil" name="ceiling" type="text" inputMode="decimal" /></div>
                </fieldset>
                <div className="flex justify-end sm:col-span-3"><button className="btn btn-sm">Add agreement</button></div>
              </form>
            </details>
          </section>

          <section className="card"><h2>Activity</h2><Timeline items={activities} /></section>
        </div>

        <div className="space-y-4">
          <section className="card">
            <h2>Hierarchy</h2>
            <ul className="mt-2 text-sm">
              {chain.map((p, i) => <li key={p.id} style={{ paddingLeft: i * 14 }}><Link href={`/organizations/${p.id}`}>{p.name}</Link></li>)}
              <li style={{ paddingLeft: chain.length * 14 }} className="font-semibold">{org.name}</li>
              {org.children.map((c) => <li key={c.id} style={{ paddingLeft: (chain.length + 1) * 14 }}><Link href={`/organizations/${c.id}`}>{c.name}</Link></li>)}
            </ul>
            {!chain.length && !org.children.length && <p className="muted mt-1 text-sm">No parent or child organizations.</p>}
          </section>
          <section className="card">
            <h2 className="mb-2">Details</h2>
            <OrgForm action={saveOrganization} org={org} domains={org.domains.map((d) => d.domain).join(", ")} orgs={orgs} />
          </section>
        </div>
      </div>
    </div>
  );
}
