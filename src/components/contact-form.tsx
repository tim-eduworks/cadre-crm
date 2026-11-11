import type { Contact } from "@prisma/client";
import { L } from "@/lib/labels";
import type { Option } from "./ui";

export function ContactForm({ action, contact, emails = "", orgs, defaultOrg }: {
  action: (fd: FormData) => Promise<void>; contact?: Contact; emails?: string; orgs: Option[]; defaultOrg?: string;
}) {
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {contact && <input type="hidden" name="id" value={contact.id} />}
      <div><label htmlFor="c-first">First name</label><input id="c-first" name="firstName" type="text" defaultValue={contact?.firstName} /></div>
      <div><label htmlFor="c-last">Last name</label><input id="c-last" name="lastName" type="text" defaultValue={contact?.lastName} /></div>
      <div><label htmlFor="c-title">Title</label><input id="c-title" name="title" type="text" defaultValue={contact?.title ?? ""} /></div>
      <div><label htmlFor="c-org">Organization</label>
        <select id="c-org" name="organizationId" defaultValue={contact?.organizationId ?? defaultOrg ?? ""}><option value="">—</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></div>
      <div className="sm:col-span-2"><label htmlFor="c-emails">Emails (comma-separated; first is primary)</label>
        <input id="c-emails" name="emails" type="text" defaultValue={emails} /></div>
      <div><label htmlFor="c-phones">Phones (comma-separated)</label><input id="c-phones" name="phones" type="text" defaultValue={contact?.phones.join(", ")} /></div>
      <div><label htmlFor="c-location">Location</label><input id="c-location" name="location" type="text" defaultValue={contact?.location ?? ""} /></div>
      <div><label htmlFor="c-linkedin">LinkedIn</label><input id="c-linkedin" name="linkedin" type="text" defaultValue={contact?.linkedin ?? ""} /></div>
      <div><label htmlFor="c-status">Status</label>
        <select id="c-status" name="status" defaultValue={contact?.status ?? "ACTIVE"}>{Object.entries(L.contactStatus).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div className="sm:col-span-2"><label htmlFor="c-tags">Tags (comma-separated)</label><input id="c-tags" name="tags" type="text" defaultValue={contact?.tags.join(", ")} /></div>
      <div className="sm:col-span-2"><label htmlFor="c-notes">Notes</label><textarea id="c-notes" name="notes" rows={3} defaultValue={contact?.notes ?? ""} /></div>
      <div className="flex justify-end sm:col-span-2"><button className="btn btn-primary btn-sm">{contact ? "Save contact" : "Create contact"}</button></div>
    </form>
  );
}
