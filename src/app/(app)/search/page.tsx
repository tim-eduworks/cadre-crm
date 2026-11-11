import Link from "next/link";
import { PageHeader, StatusChip } from "@/components/ui";
import { personName } from "@/lib/format";
import { L } from "@/lib/labels";
import { db } from "@/server/db";
import { contactWhere, orgWhere } from "@/server/list-filters";
import { requireUser } from "@/server/session";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireUser();
  const q = ((await searchParams).q ?? "").trim();
  const [opps, orgs, contacts] = q.length < 2 ? [[], [], []] : await Promise.all([
    db.opportunity.findMany({
      where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { organization: { name: { contains: q, mode: "insensitive" } } }] },
      include: { organization: true }, take: 25, orderBy: { updatedAt: "desc" },
    }),
    db.organization.findMany({ where: orgWhere({ q }), take: 25, orderBy: { name: "asc" } }),
    db.contact.findMany({ where: contactWhere({ q, status: "ALL" }), include: { organization: true, emails: true }, take: 25, orderBy: [{ lastName: "asc" }] }),
  ]);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={q ? `Search: ${q}` : "Search"} />
      {q.length < 2 ? <p className="muted">Type at least two characters in the search box.</p> : (
        <div className="space-y-4">
          <section className="card"><h2>Opportunities ({opps.length})</h2>
            <ul className="mt-2 divide-y divide-slate-200">
              {opps.map((o) => <li key={o.id} className="flex items-center justify-between py-1.5"><span><Link href={`/opportunities/${o.id}`} className="font-medium">{o.name}</Link>
                <span className="muted"> · {o.organization?.name}</span></span><StatusChip status={o.status} /></li>)}
              {!opps.length && <li className="muted py-1.5">None.</li>}
            </ul></section>
          <section className="card"><h2>Organizations ({orgs.length})</h2>
            <ul className="mt-2 divide-y divide-slate-200">
              {orgs.map((o) => <li key={o.id} className="py-1.5"><Link href={`/organizations/${o.id}`} className="font-medium">{o.name}</Link><span className="muted"> · {L.orgType[o.type]}</span></li>)}
              {!orgs.length && <li className="muted py-1.5">None.</li>}
            </ul>
            {orgs.length === 25 && <p className="mt-1 text-sm"><Link href={`/organizations?q=${encodeURIComponent(q)}`}>More organizations</Link></p>}</section>
          <section className="card"><h2>Contacts ({contacts.length})</h2>
            <ul className="mt-2 divide-y divide-slate-200">
              {contacts.map((c) => <li key={c.id} className="py-1.5"><Link href={`/contacts/${c.id}`} className="font-medium">{personName(c)}</Link>
                <span className="muted"> · {[c.organization?.name, c.emails[0]?.email, c.status !== "ACTIVE" ? L.contactStatus[c.status] : null].filter(Boolean).join(" · ")}</span></li>)}
              {!contacts.length && <li className="muted py-1.5">None.</li>}
            </ul>
            {contacts.length === 25 && <p className="mt-1 text-sm"><Link href={`/contacts?q=${encodeURIComponent(q)}&status=ALL`}>More contacts</Link></p>}</section>
        </div>
      )}
    </div>
  );
}
