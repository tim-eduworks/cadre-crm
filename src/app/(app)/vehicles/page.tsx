import { ErrorBanner, PageHeader } from "@/components/ui";
import { date, money } from "@/lib/format";
import { db } from "@/server/db";
import { requireUser } from "@/server/session";
import { saveVehicle } from "../actions";

export default async function VehiclesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireUser();
  const { error } = await searchParams;
  const rows = await db.contractVehicle.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { opportunities: true } } } });
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Contract vehicles" sub="Reusable across opportunities." />
      <ErrorBanner error={error} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card overflow-x-auto lg:col-span-2">
          <table className="table">
            <thead><tr><th>Name</th><th>Type</th><th>Agency</th><th>Number</th><th className="!text-right">Ceiling</th><th>Period of performance</th><th className="!text-right">Opps</th></tr></thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id}><td className="font-medium">{v.name}{v.notes && <div className="text-xs font-normal text-slate-500">{v.notes}</div>}</td><td>{v.type ?? "—"}</td><td>{v.agency ?? "—"}</td>
                  <td>{v.number ?? "—"}</td><td className="text-right">{money(v.ceiling)}</td><td>{date(v.popStart)} – {date(v.popEnd)}</td><td className="text-right">{v._count.opportunities}</td></tr>
              ))}
              {!rows.length && <tr><td colSpan={7} className="muted">No contract vehicles yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <form action={saveVehicle} className="card grid gap-3 self-start sm:grid-cols-2">
          <h2 className="sm:col-span-2">Add vehicle</h2>
          <div className="sm:col-span-2"><label htmlFor="v-name">Name</label><input id="v-name" name="name" type="text" required /></div>
          <div><label htmlFor="v-type">Type</label><input id="v-type" name="type" type="text" placeholder="OTA, IDIQ, GSA…" /></div>
          <div><label htmlFor="v-agency">Agency</label><input id="v-agency" name="agency" type="text" /></div>
          <div><label htmlFor="v-number">Number</label><input id="v-number" name="number" type="text" /></div>
          <div><label htmlFor="v-ceiling">Ceiling (USD)</label><input id="v-ceiling" name="ceiling" type="text" inputMode="decimal" /></div>
          <div><label htmlFor="v-start">PoP start</label><input id="v-start" name="popStart" type="date" /></div>
          <div><label htmlFor="v-end">PoP end</label><input id="v-end" name="popEnd" type="date" /></div>
          <div className="sm:col-span-2"><label htmlFor="v-notes">Notes</label><input id="v-notes" name="notes" type="text" /></div>
          <div className="flex justify-end sm:col-span-2"><button className="btn btn-primary btn-sm">Add vehicle</button></div>
        </form>
      </div>
    </div>
  );
}
