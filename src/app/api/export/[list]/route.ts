import { NextResponse } from "next/server";
import { CRITERIA } from "@/domain/types";
import { ratingOf } from "@/domain/scorecard";
import { dateInput, personName, toCsv, userName } from "@/lib/format";
import { CRITERION_LABEL, L, label } from "@/lib/labels";
import { contactWhere, orgWhere } from "@/server/list-filters";
import { db } from "@/server/db";
import { listOpportunities } from "@/server/queries";
import { getStages } from "@/server/config";
import { currentUser } from "@/server/session";

/** CSV export of a list view, honouring the same filters as the page (passed as query params). */
export async function GET(req: Request, { params }: { params: Promise<{ list: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { list } = await params;
  const q = Object.fromEntries(new URL(req.url).searchParams);
  let csv: string;

  if (list === "opportunities") {
    const [rows, stages] = await Promise.all([listOpportunities(q), getStages()]);
    const stageName = new Map(stages.map((s) => [s.number, s.name]));
    csv = toCsv(
      ["Opportunity", "Organization", "Stage #", "Stage", "Status", "Hold/close reason", "Confidence tier", "TCV", "TCV basis", "Award window",
        "Branch", "Engagement type", "Owner", ...CRITERIA.map((c) => CRITERION_LABEL[c]), "Next action", "Next action due", "Last touch"],
      rows.map((o) => [
        o.name, o.organization?.name, o.stage, stageName.get(o.stage), L.status[o.status], o.holdReason ?? o.closeReason, o.tier, o.tcvNumber,
        L.tcvFlag[o.tcvFlag], o.awardWindow, o.branch, L.engagementType[o.engagementType], userName(o.owner),
        ...CRITERIA.map((c) => L.rating[ratingOf(o.scorecardMap, c)]), o.nextAction?.title, dateInput(o.nextAction?.dueDate), dateInput(o.lastTouchAt),
      ]),
    );
  } else if (list === "contacts") {
    const rows = await db.contact.findMany({
      where: contactWhere(q), include: { organization: true, emails: true, owner: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    csv = toCsv(
      ["First name", "Last name", "Title", "Organization", "Primary email", "Other emails", "Phones", "Status", "Tags", "Source", "Owner", "Last touch"],
      rows.map((c) => [
        c.firstName, c.lastName, c.title, c.organization?.name, c.emails.find((e) => e.isPrimary)?.email ?? c.emails[0]?.email,
        c.emails.filter((e) => !e.isPrimary).map((e) => e.email).join("; "), c.phones.join("; "), L.contactStatus[c.status], c.tags.join("; "),
        L.contactSource[c.source], c.owner ? userName(c.owner) : "", dateInput(c.lastTouchAt),
      ]),
    );
  } else if (list === "organizations") {
    const rows = await db.organization.findMany({
      where: orgWhere(q), include: { parent: true, domains: true, _count: { select: { contacts: true, opportunities: true } } }, orderBy: { name: "asc" },
    });
    csv = toCsv(
      ["Organization", "Type", "Market", "Parent", "Email domains", "Website", "Contacts", "Opportunities"],
      rows.map((o) => [o.name, L.orgType[o.type], label(L.market, o.market, ""), o.parent?.name, o.domains.map((d) => d.domain).join("; "), o.website, o._count.contacts, o._count.opportunities]),
    );
  } else if (list === "tasks") {
    const rows = await db.task.findMany({
      where: { done: false, ...(q.who === "all" ? {} : { assigneeId: user.id }) },
      include: { opportunity: true, contact: true, assignee: true }, orderBy: { dueDate: "asc" },
    });
    csv = toCsv(
      ["Task", "Due", "Assignee", "Opportunity", "Contact", "Next action?"],
      rows.map((t) => [t.title, dateInput(t.dueDate), t.assignee ? userName(t.assignee) : "", t.opportunity?.name, t.contact ? personName(t.contact) : "", t.isPrimary ? "Yes" : ""]),
    );
  } else {
    return NextResponse.json({ error: "Unknown list" }, { status: 404 });
  }

  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${list}-${dateInput(new Date())}.csv"` },
  });
}
