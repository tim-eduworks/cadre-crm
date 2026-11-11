import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactForm } from "@/components/contact-form";
import { Timeline, timelineInclude } from "@/components/timeline";
import { ErrorBanner, PageHeader, StatusChip } from "@/components/ui";
import { date, personName, userName } from "@/lib/format";
import { L } from "@/lib/labels";
import { db } from "@/server/db";
import { orgOptions } from "@/server/queries";
import { requireUser } from "@/server/session";
import { saveContact } from "../../actions";

export default async function ContactPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  await requireUser();
  const { id } = await params;
  const { error } = await searchParams;
  const c = await db.contact.findUnique({
    where: { id },
    include: {
      organization: { include: { parent: true } }, emails: { orderBy: { isPrimary: "desc" } }, owner: true,
      stakeholderOn: { include: { opportunity: { include: { organization: true } } } },
      tasks: { where: { done: false }, orderBy: { dueDate: "asc" } },
    },
  });
  if (!c) notFound();
  const [activities, orgs] = await Promise.all([
    db.activity.findMany({ where: { participants: { some: { contactId: id } } }, include: timelineInclude, orderBy: { occurredAt: "desc" }, take: 100 }),
    orgOptions(),
  ]);
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={personName(c)}
        sub={<>
          {c.title && `${c.title} · `}
          {c.organization ? <>{c.organization.parent && <><Link href={`/organizations/${c.organization.parent.id}`}>{c.organization.parent.name}</Link> → </>}
            <Link href={`/organizations/${c.organization.id}`}>{c.organization.name}</Link></> : "No organization"}
          {" · "}{L.contactStatus[c.status]}{" · "}{L.contactSource[c.source]}{c.owner && ` · Owner: ${userName(c.owner)}`}
        </>}
      />
      <ErrorBanner error={error} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="card">
            <h2>Opportunities</h2>
            <ul className="mt-2 divide-y divide-slate-200">
              {c.stakeholderOn.map((s) => (
                <li key={s.opportunityId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div><Link href={`/opportunities/${s.opportunityId}`} className="font-medium">{s.opportunity.name}</Link>
                    <div className="text-xs text-slate-500">{s.opportunity.organization?.name}</div></div>
                  <span className="flex flex-wrap items-center gap-1">{s.roles.map((r) => <span key={r} className="chip">{L.stakeholderRole[r]}</span>)}<StatusChip status={s.opportunity.status} /></span>
                </li>
              ))}
              {!c.stakeholderOn.length && <li className="muted py-2">Not a stakeholder on any opportunity.</li>}
            </ul>
          </section>
          <section className="card">
            <h2>Activity</h2>
            <p className="text-xs text-slate-500">Last touch: {date(c.lastTouchAt)}</p>
            <Timeline items={activities} />
          </section>
        </div>
        <div className="space-y-4">
          <section className="card">
            <h2>Reach</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {c.emails.map((e) => <li key={e.email}><a href={`mailto:${e.email}`}>{e.email}</a>{e.isPrimary && <span className="chip ml-1">Primary</span>}</li>)}
              {c.phones.map((p) => <li key={p}>{p}</li>)}
              {c.linkedin && <li>{/^https:\/\//i.test(c.linkedin) ? <a href={c.linkedin} target="_blank" rel="noreferrer">LinkedIn</a> : c.linkedin}</li>}
              {c.location && <li className="text-slate-600">{c.location}</li>}
              {!c.emails.length && !c.phones.length && <li className="muted">No email or phone on file.</li>}
            </ul>
            {c.tags.length > 0 && <p className="mt-2">{c.tags.map((t) => <Link key={t} href={`/contacts?tag=${encodeURIComponent(t)}&status=ALL`} className="chip mr-1">{t}</Link>)}</p>}
          </section>
          <section className="card"><h2 className="mb-2">Details</h2>
            <ContactForm action={saveContact} contact={c} emails={c.emails.map((e) => e.email).join(", ")} orgs={orgs} /></section>
        </div>
      </div>
    </div>
  );
}
