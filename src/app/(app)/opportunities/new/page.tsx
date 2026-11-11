import Link from "next/link";
import { ErrorBanner, PageHeader } from "@/components/ui";
import { dateInput } from "@/lib/format";
import { L } from "@/lib/labels";
import { orgOptions, userOptions } from "@/server/queries";
import { requireUser } from "@/server/session";
import { createOpportunity } from "../../actions";

export default async function NewOpportunity({ searchParams }: { searchParams: Promise<{ error?: string; org?: string }> }) {
  const user = await requireUser();
  const { error, org } = await searchParams;
  const [orgs, users] = await Promise.all([orgOptions(), userOptions()]);
  const nextWeek = new Date(Date.now() + 7 * 86_400_000);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New opportunity" sub="Starts at stage 1, Identify Problem." />
      <ErrorBanner error={error} />
      <form action={createOpportunity} className="card grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="name">Opportunity name <span className="text-red-600">*</span></label>
          <input id="name" name="name" type="text" required />
        </div>
        <div>
          <label htmlFor="organizationId">Customer organization</label>
          <select id="organizationId" name="organizationId" defaultValue={org ?? ""}>
            <option value="">—</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <p className="mt-1 text-xs text-slate-500">Not listed? <Link href="/organizations/new">Add the organization</Link> first.</p>
        </div>
        <div>
          <label htmlFor="engagementType">Engagement type <span className="text-red-600">*</span></label>
          <select id="engagementType" name="engagementType" required defaultValue="DIRECT">
            {Object.entries(L.engagementType).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ownerId">Owner</label>
          <select id="ownerId" name="ownerId" defaultValue={user.id}>{users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</select>
        </div>
        <div>
          <label htmlFor="tcv">Total Contract Value, USD (estimate is fine)</label>
          <input id="tcv" name="tcv" type="text" inputMode="decimal" placeholder="250000" />
        </div>
        <div className="sm:col-span-2"><label htmlFor="problem">Problem</label><textarea id="problem" name="problem" rows={2} /></div>
        <div className="sm:col-span-2"><label htmlFor="impact">Impact</label><textarea id="impact" name="impact" rows={2} /></div>
        <fieldset className="grid gap-4 border-t border-slate-200 pt-4 sm:col-span-2 sm:grid-cols-3">
          <legend className="sr-only">Next action</legend>
          <div className="sm:col-span-3">
            <label htmlFor="nextAction">Next action <span className="text-red-600">*</span></label>
            <input id="nextAction" name="nextAction" type="text" required placeholder="e.g. Schedule discovery call with training lead" />
          </div>
          <div><label htmlFor="nextActionDue">Due <span className="text-red-600">*</span></label><input id="nextActionDue" name="nextActionDue" type="date" required defaultValue={dateInput(nextWeek)} /></div>
          <div className="sm:col-span-2">
            <label htmlFor="nextActionAssignee">Assignee</label>
            <select id="nextActionAssignee" name="nextActionAssignee" defaultValue={user.id}>{users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</select>
          </div>
        </fieldset>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Link className="btn" href="/">Cancel</Link>
          <button className="btn btn-primary">Create opportunity</button>
        </div>
      </form>
    </div>
  );
}
