import Link from "next/link";
import { PageHeader, Pager } from "@/components/ui";
import { date, personName } from "@/lib/format";
import { L } from "@/lib/labels";
import { db } from "@/server/db";
import { contactWhere } from "@/server/list-filters";
import { requireUser } from "@/server/session";

const PAGE = 50;

export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; tag?: string; page?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = contactWhere(sp);
  const [rows, total] = await Promise.all([
    db.contact.findMany({ where, include: { organization: true, emails: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], skip: (page - 1) * PAGE, take: PAGE }),
    db.contact.count({ where }),
  ]);
  const qs = (extra: Record<string, string> = {}) =>
    new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.status ? { status: sp.status } : {}), ...(sp.tag ? { tag: sp.tag } : {}), ...extra }).toString();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Contacts">
        <Link className="btn" href={`/api/export/contacts?${qs()}`} prefetch={false}>Export CSV</Link>
        <Link className="btn btn-primary" href="/contacts/new">New contact</Link>
      </PageHeader>
      <form className="card mb-3 flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1"><label htmlFor="q">Name, email or organization</label><input id="q" name="q" type="search" defaultValue={sp.q} /></div>
        <div><label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={sp.status ?? "ACTIVE"}>
            {Object.entries(L.contactStatus).map(([k, v]) => <option key={k} value={k}>{v}</option>)}<option value="ALL">All</option></select></div>
        <div><label htmlFor="tag">Tag</label><input id="tag" name="tag" type="text" defaultValue={sp.tag} className="!w-40" /></div>
        <button className="btn">Filter</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Name</th><th>Title</th><th>Organization</th><th>Email</th><th>Tags</th><th>Status</th><th>Last touch</th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td><Link href={`/contacts/${c.id}`} className="font-medium">{personName(c)}</Link></td>
                <td>{c.title ?? "—"}</td>
                <td>{c.organization ? <Link href={`/organizations/${c.organization.id}`}>{c.organization.name}</Link> : "—"}</td>
                <td>{c.emails.find((e) => e.isPrimary)?.email ?? c.emails[0]?.email ?? "—"}</td>
                <td>{c.tags.map((t) => <span key={t} className="chip mr-1">{t}</span>)}</td>
                <td>{L.contactStatus[c.status]}</td>
                <td>{date(c.lastTouchAt)}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="muted">No contacts match.</td></tr>}
          </tbody>
        </table>
        <Pager page={page} pageSize={PAGE} total={total} hrefFor={(p) => `/contacts?${qs({ page: String(p) })}`} />
      </div>
    </div>
  );
}
