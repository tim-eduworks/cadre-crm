import type { Organization } from "@prisma/client";
import { L } from "@/lib/labels";
import type { Option } from "./ui";

export function OrgForm({ action, org, domains = "", orgs, back }: {
  action: (fd: FormData) => Promise<void>; org?: Organization; domains?: string; orgs: Option[]; back?: string;
}) {
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {org && <input type="hidden" name="id" value={org.id} />}
      {back && <input type="hidden" name="back" value={back} />}
      <div className="sm:col-span-2"><label htmlFor="o-name">Name <span className="text-red-600">*</span></label><input id="o-name" name="name" type="text" required defaultValue={org?.name} /></div>
      <div><label htmlFor="o-type">Type</label>
        <select id="o-type" name="type" defaultValue={org?.type ?? "OTHER"}>{Object.entries(L.orgType).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div><label htmlFor="o-market">Market</label>
        <select id="o-market" name="market" defaultValue={org?.market ?? ""}><option value="">—</option>{Object.entries(L.market).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div><label htmlFor="o-parent">Parent organization</label>
        <select id="o-parent" name="parentId" defaultValue={org?.parentId ?? ""}><option value="">— (top level)</option>
          {orgs.filter((o) => o.id !== org?.id).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></div>
      <div><label htmlFor="o-web">Website</label><input id="o-web" name="website" type="text" defaultValue={org?.website ?? ""} /></div>
      <div className="sm:col-span-2"><label htmlFor="o-domains">Email domains (comma-separated; used to match contacts and email)</label>
        <input id="o-domains" name="domains" type="text" defaultValue={domains} placeholder="example.com, example.org" /></div>
      <div className="sm:col-span-2"><label htmlFor="o-notes">Notes</label><textarea id="o-notes" name="notes" rows={3} defaultValue={org?.notes ?? ""} /></div>
      <div className="flex justify-end sm:col-span-2"><button className="btn btn-primary btn-sm">{org ? "Save organization" : "Create organization"}</button></div>
    </form>
  );
}
