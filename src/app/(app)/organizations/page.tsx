import Link from "next/link";
import { PageHeader, Pager } from "@/components/ui";
import { L, label } from "@/lib/labels";
import { db } from "@/server/db";
import { orgWhere } from "@/server/list-filters";
import { requireUser } from "@/server/session";

const PAGE = 50;

export default async function OrganizationsPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; page?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = orgWhere(sp);
  const [rows, total] = await Promise.all([
    db.organization.findMany({
      where, orderBy: { name: "asc" }, skip: (page - 1) * PAGE, take: PAGE,
      include: { parent: true, domains: true, _count: { select: { contacts: true, opportunities: true } } },
    }),
    db.organization.count({ where }),
  ]);
  const qs = (extra: Record<string, string> = {}) =>
    new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.type ? { type: sp.type } : {}), ...extra }).toString();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Organizations">
        <Link className="btn" href={`/api/export/organizations?${qs()}`} prefetch={false}>Export CSV</Link>
        <Link className="btn btn-primary" href="/organizations/new">New organization</Link>
      </PageHeader>
      <form className="card mb-3 flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1"><label htmlFor="q">Name or domain</label><input id="q" name="q" type="search" defaultValue={sp.q} /></div>
        <div><label htmlFor="type">Type</label>
          <select id="type" name="type" defaultValue={sp.type ?? ""}><option value="">All</option>{Object.entries(L.orgType).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <button className="btn">Filter</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Organization</th><th>Type</th><th>Market</th><th>Parent</th><th>Domains</th><th className="!text-right">Contacts</th><th className="!text-right">Opps</th></tr></thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id}>
                <td><Link href={`/organizations/${o.id}`} className="font-medium">{o.name}</Link></td>
                <td>{L.orgType[o.type]}</td>
                <td>{label(L.market, o.market)}</td>
                <td>{o.parent ? <Link href={`/organizations/${o.parent.id}`}>{o.parent.name}</Link> : "—"}</td>
                <td className="text-xs text-slate-600">{o.domains.map((d) => d.domain).join(", ")}</td>
                <td className="text-right">{o._count.contacts}</td>
                <td className="text-right">{o._count.opportunities}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="muted">No organizations match.</td></tr>}
          </tbody>
        </table>
        <Pager page={page} pageSize={PAGE} total={total} hrefFor={(p) => `/organizations?${qs({ page: String(p) })}`} />
      </div>
    </div>
  );
}
