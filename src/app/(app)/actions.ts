"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  Prisma, type ActivityType, type AgreementStatus, type AgreementType, type ContactStatus, type CriterionResult, type DocType,
  type EngagementType, type Market, type OppStatus, type OrgType, type PartnerRole, type PricingModel, type RequirementTag,
  type StakeholderRole, type TeamFunction, type User,
} from "@prisma/client";
import { CRITERIA, type Rating } from "@/domain/types";
import { L } from "@/lib/labels";
import { FIELD_BY_NAME } from "@/lib/opportunity-fields";
import { db } from "@/server/db";
import { GateError, moveStage, recordTouch, saveScorecard, setAwardWindow, setStatus, updateFields } from "@/server/opportunities";
import { AppError, requireAdmin, requireUser } from "@/server/session";

// ---------- helpers ----------

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const opt = (fd: FormData, k: string) => str(fd, k) || null;
function oneOf<T extends string>(map: Record<string, string>, v: string, what: string): T {
  if (!(v in map)) throw new AppError(`${what}: invalid choice.`, 422);
  return v as T;
}
function optOneOf<T extends string>(map: Record<string, string>, v: string, what: string): T | null {
  return v ? oneOf<T>(map, v, what) : null;
}
function day(v: string): Date | null {
  if (!v) return null;
  const d = new Date(v.length <= 10 ? `${v}T00:00:00Z` : v);
  if (Number.isNaN(d.getTime())) throw new AppError("Invalid date.", 422);
  return d;
}
function dollars(v: string): Prisma.Decimal | null {
  if (!v) return null;
  const n = Number(v.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) throw new AppError("Enter a dollar amount.", 422);
  return new Prisma.Decimal(n.toFixed(2));
}
/** Only same-site relative paths are accepted as a return target. */
function backPath(fd: FormData, fallback: string) {
  const b = str(fd, "back");
  return b.startsWith("/") && !b.startsWith("//") ? b : fallback;
}
function withError(path: string, message: string) {
  const [rest, hash = ""] = path.split("#");
  const [base, query = ""] = rest.split("?");
  const p = new URLSearchParams(query);
  p.set("error", message);
  return `${base}?${p}${hash ? `#${hash}` : ""}`;
}

/**
 * Runs a mutation for a signed-in user, then returns to `back`. Validation problems come back
 * as an ?error= banner on the same page instead of an error screen.
 */
async function act(fd: FormData, fallback: string, fn: (user: User) => Promise<string | void>) {
  const user = await requireUser();
  const back = backPath(fd, fallback);
  let dest: string | void;
  try {
    dest = await fn(user);
  } catch (e) {
    if (e instanceof GateError) {
      const lines = e.unmet.flatMap((u) => [`${u.stage}. ${u.name} — not yet met:`, ...u.items.map((i) => `  • ${i}`)]);
      redirect(withError(back, `This move is blocked by the stage gate.\n${lines.join("\n")}`));
    }
    if (e instanceof AppError) redirect(withError(back, e.message));
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") redirect(withError(back, "That already exists (duplicate)."));
    throw e;
  }
  revalidatePath("/", "layout");
  redirect(dest ?? back);
}

async function oppExists(id: string) {
  if (!id || !(await db.opportunity.findUnique({ where: { id }, select: { id: true } }))) throw new AppError("Opportunity not found", 404);
  return id;
}

// ---------- opportunities ----------

export async function createOpportunity(fd: FormData) {
  await act(fd, "/opportunities/new", async (user) => {
    const name = str(fd, "name");
    if (!name) throw new AppError("Opportunity name is required.", 422);
    const nextAction = str(fd, "nextAction");
    const due = day(str(fd, "nextActionDue"));
    if (!nextAction || !due) throw new AppError("Every open opportunity needs a next action with a due date.", 422);
    const opp = await db.opportunity.create({
      data: {
        name,
        organizationId: opt(fd, "organizationId"),
        ownerId: str(fd, "ownerId") || user.id,
        engagementType: oneOf<EngagementType>(L.engagementType, str(fd, "engagementType"), "Engagement type"),
        tcv: dollars(str(fd, "tcv")) ?? new Prisma.Decimal(0),
        problem: opt(fd, "problem"),
        impact: opt(fd, "impact"),
        scorecard: { create: CRITERIA.map((criterion) => ({ criterion })) },
        tasks: { create: { title: nextAction, dueDate: due, assigneeId: str(fd, "nextActionAssignee") || user.id, isPrimary: true } },
      },
    });
    return `/opportunities/${opp.id}`;
  });
}

export async function saveSection(fd: FormData) {
  const id = str(fd, "id");
  await act(fd, `/opportunities/${id}`, async (user) => {
    const input: Record<string, string> = {};
    for (const [k, v] of fd.entries()) if (FIELD_BY_NAME.has(k) && typeof v === "string") input[k] = v;
    await updateFields(user, id, input, str(fd, "tcvComment"));
  });
}

export async function saveAward(fd: FormData) {
  const id = str(fd, "id");
  await act(fd, `/opportunities/${id}`, async () => {
    const q = str(fd, "awardQuarter"), fy = str(fd, "awardFy");
    await setAwardWindow(id, q ? Number(q) : null, fy ? Number(fy) : null);
  });
}

export async function saveStatus(fd: FormData) {
  const id = str(fd, "id");
  await act(fd, `/opportunities/${id}`, async (user) => {
    await setStatus(user, id, oneOf<OppStatus>(L.status, str(fd, "status"), "Status"), str(fd, "reason"));
  });
}

export async function moveStageAction(fd: FormData) {
  const id = str(fd, "id");
  await act(fd, `/opportunities/${id}`, async (user) => {
    await moveStage(user, id, Number(str(fd, "target")), { comment: str(fd, "comment"), override: fd.get("override") === "1" });
  });
}

export async function saveScorecardAction(fd: FormData) {
  const id = str(fd, "id");
  await act(fd, `/opportunities/${id}`, async (user) => {
    await oppExists(id);
    await saveScorecard(
      user,
      id,
      CRITERIA.map((criterion) => ({
        criterion,
        rating: oneOf<Rating>(L.rating, str(fd, `rating_${criterion}`) || "UNKNOWN", "Rating"),
        justification: str(fd, `just_${criterion}`),
        reviewed: fd.get(`reviewed_${criterion}`) === "1",
      })),
    );
  });
}

export async function saveStakeholder(fd: FormData) {
  const id = str(fd, "id");
  await act(fd, `/opportunities/${id}?tab=stakeholders`, async () => {
    await oppExists(id);
    let contactId = str(fd, "contactId");
    const email = str(fd, "email").toLowerCase();
    if (!contactId && email) {
      contactId = (await db.contactEmail.findUnique({ where: { email } }))?.contactId ?? "";
      if (!contactId) throw new AppError(`No contact with email ${email}. Create the contact first.`, 422);
    }
    if (!contactId) throw new AppError("Choose a contact or enter a contact's email.", 422);
    const roles = fd.getAll("roles").map((r) => oneOf<StakeholderRole>(L.stakeholderRole, String(r), "Role"));
    await db.opportunityStakeholder.upsert({
      where: { opportunityId_contactId: { opportunityId: id, contactId } },
      create: { opportunityId: id, contactId, roles },
      update: { roles },
    });
  });
}

export async function removeStakeholder(fd: FormData) {
  const id = str(fd, "id");
  await act(fd, `/opportunities/${id}?tab=stakeholders`, async () => {
    await db.opportunityStakeholder.deleteMany({ where: { opportunityId: id, contactId: str(fd, "contactId") } });
  });
}

export async function saveTeamMember(fd: FormData) {
  const id = str(fd, "id");
  await act(fd, `/opportunities/${id}?tab=stakeholders`, async () => {
    await oppExists(id);
    const userId = str(fd, "userId");
    const fn = oneOf<TeamFunction>(L.teamFunction, str(fd, "function"), "Function");
    await db.opportunityTeamMember.upsert({
      where: { opportunityId_userId: { opportunityId: id, userId } },
      create: { opportunityId: id, userId, function: fn },
      update: { function: fn },
    });
  });
}

export async function removeTeamMember(fd: FormData) {
  const id = str(fd, "id");
  await act(fd, `/opportunities/${id}?tab=stakeholders`, async () => {
    await db.opportunityTeamMember.deleteMany({ where: { opportunityId: id, userId: str(fd, "userId") } });
  });
}

export async function savePartner(fd: FormData) {
  const id = str(fd, "id");
  await act(fd, `/opportunities/${id}?tab=stakeholders`, async () => {
    await oppExists(id);
    const organizationId = str(fd, "organizationId");
    if (!organizationId) throw new AppError("Choose an organization.", 422);
    await db.opportunityPartner.create({
      data: {
        opportunityId: id, organizationId, role: oneOf<PartnerRole>(L.partnerRole, str(fd, "role"), "Role"),
        customerContactOwner: opt(fd, "customerContactOwner"), notes: opt(fd, "notes"),
      },
    });
  });
}

export async function removePartner(fd: FormData) {
  const id = str(fd, "id");
  await act(fd, `/opportunities/${id}?tab=stakeholders`, async () => {
    await db.opportunityPartner.deleteMany({ where: { id: str(fd, "partnerId"), opportunityId: id } });
  });
}

export async function saveCriterion(fd: FormData) {
  const id = str(fd, "id");
  await act(fd, `/opportunities/${id}`, async () => {
    await oppExists(id);
    const text = str(fd, "text");
    if (!text) throw new AppError("Describe the success criterion.", 422);
    const data = { text, result: optOneOf<CriterionResult>(L.criterionResult, str(fd, "result"), "Result"), evidence: opt(fd, "evidence") };
    const cid = str(fd, "criterionId");
    if (cid) await db.successCriterion.updateMany({ where: { id: cid, opportunityId: id }, data });
    else await db.successCriterion.create({ data: { opportunityId: id, ...data } });
  });
}

export async function removeCriterion(fd: FormData) {
  const id = str(fd, "id");
  await act(fd, `/opportunities/${id}`, async () => {
    await db.successCriterion.deleteMany({ where: { id: str(fd, "criterionId"), opportunityId: id } });
  });
}

export async function saveRequirement(fd: FormData) {
  const id = str(fd, "id");
  await act(fd, `/opportunities/${id}`, async () => {
    await oppExists(id);
    const text = str(fd, "text");
    if (!text) throw new AppError("Describe the requirement.", 422);
    const data = { text, tag: optOneOf<RequirementTag>(L.requirementTag, str(fd, "tag"), "Tag") };
    const rid = str(fd, "requirementId");
    if (rid) await db.solutionRequirement.updateMany({ where: { id: rid, opportunityId: id }, data });
    else await db.solutionRequirement.create({ data: { opportunityId: id, ...data } });
  });
}

export async function removeRequirement(fd: FormData) {
  const id = str(fd, "id");
  await act(fd, `/opportunities/${id}`, async () => {
    await db.solutionRequirement.deleteMany({ where: { id: str(fd, "requirementId"), opportunityId: id } });
  });
}

export async function saveDocument(fd: FormData) {
  const id = str(fd, "id");
  await act(fd, `/opportunities/${id}?tab=documents`, async () => {
    await oppExists(id);
    const url = str(fd, "url");
    if (!/^https:\/\//i.test(url)) throw new AppError("Paste the document's https:// link.", 422);
    const type = oneOf<DocType>(L.docType, str(fd, "type"), "Document type");
    await db.opportunityDocument.create({ data: { opportunityId: id, type, title: str(fd, "title") || L.docType[type], url } });
  });
}

export async function removeDocument(fd: FormData) {
  const id = str(fd, "id");
  await act(fd, `/opportunities/${id}?tab=documents`, async () => {
    await db.opportunityDocument.deleteMany({ where: { id: str(fd, "documentId"), opportunityId: id } });
  });
}

// ---------- activities & tasks ----------

export async function logActivity(fd: FormData) {
  await act(fd, "/", async (user) => {
    const subject = str(fd, "subject");
    if (!subject) throw new AppError("Give the activity a subject.", 422);
    const occurredAt = day(str(fd, "occurredAt")) ?? new Date();
    const opportunityId = opt(fd, "opportunityId");
    let organizationId = opt(fd, "organizationId");
    if (opportunityId && !organizationId) organizationId = (await db.opportunity.findUnique({ where: { id: opportunityId } }))?.organizationId ?? null;
    const contactIds = [...new Set(fd.getAll("contactIds").map(String).filter(Boolean))];
    await db.$transaction(async (tx) => {
      await tx.activity.create({
        data: {
          type: oneOf<ActivityType>(L.activityType, str(fd, "type"), "Activity type"),
          occurredAt, subject, snippet: opt(fd, "snippet")?.slice(0, 2000) ?? null,
          problemFocused: fd.get("problemFocused") === "1",
          opportunityId, organizationId, createdById: user.id,
          participants: { create: [{ userId: user.id }, ...contactIds.map((contactId) => ({ contactId }))] },
        },
      });
      await recordTouch(tx, occurredAt, opportunityId, contactIds);
    });
  });
}

export async function saveTask(fd: FormData) {
  await act(fd, "/next-actions", async (user) => {
    const title = str(fd, "title");
    if (!title) throw new AppError("Give the task a title.", 422);
    const opportunityId = opt(fd, "opportunityId");
    const isPrimary = fd.get("isPrimary") === "1" && !!opportunityId;
    const dueDate = day(str(fd, "dueDate"));
    if (isPrimary && !dueDate) throw new AppError("A next action needs a due date.", 422);
    await db.$transaction(async (tx) => {
      // An opportunity has one next action: the new one replaces the old as primary.
      if (isPrimary) await tx.task.updateMany({ where: { opportunityId, isPrimary: true }, data: { isPrimary: false } });
      await tx.task.create({
        data: { title, dueDate, assigneeId: str(fd, "assigneeId") || user.id, opportunityId, contactId: opt(fd, "contactId"), isPrimary },
      });
    });
  });
}

export async function toggleTask(fd: FormData) {
  await act(fd, "/next-actions", async () => {
    const task = await db.task.findUnique({ where: { id: str(fd, "taskId") } });
    if (!task) throw new AppError("Task not found", 404);
    await db.task.update({ where: { id: task.id }, data: { done: !task.done, doneAt: task.done ? null : new Date() } });
  });
}

// ---------- organizations ----------

function parseDomains(v: string): string[] {
  const out = [...new Set(v.toLowerCase().split(/[\s,;]+/).map((d) => d.replace(/^@/, "").trim()).filter(Boolean))];
  for (const d of out) if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) throw new AppError(`"${d}" is not a valid email domain.`, 422);
  return out;
}

export async function saveOrganization(fd: FormData) {
  const id = str(fd, "id");
  await act(fd, id ? `/organizations/${id}` : "/organizations/new", async (user) => {
    const name = str(fd, "name");
    if (!name) throw new AppError("Organization name is required.", 422);
    const parentId = opt(fd, "parentId");
    if (id && parentId) {
      // Reject cycles: the new parent must not be this org or one of its descendants.
      for (let cur: string | null = parentId, hops = 0; cur; hops++) {
        if (cur === id || hops > 50) throw new AppError("An organization can't be its own parent or ancestor.", 422);
        cur = (await db.organization.findUnique({ where: { id: cur }, select: { parentId: true } }))?.parentId ?? null;
      }
    }
    const domains = parseDomains(str(fd, "domains"));
    const shared = await db.sharedDomain.findMany({ where: { domain: { in: domains } } });
    if (shared.length) throw new AppError(`${shared.map((s) => s.domain).join(", ")} is a shared domain and can't belong to one organization.`, 422);
    const taken = await db.orgDomain.findMany({ where: { domain: { in: domains }, ...(id ? { NOT: { organizationId: id } } : {}) }, include: { organization: true } });
    if (taken.length) throw new AppError(taken.map((t) => `${t.domain} already belongs to ${t.organization.name}`).join("; ") + ".", 422);
    const data = {
      name, parentId,
      type: oneOf<OrgType>(L.orgType, str(fd, "type") || "OTHER", "Type"),
      market: optOneOf<Market>(L.market, str(fd, "market"), "Market"),
      website: opt(fd, "website"), notes: opt(fd, "notes"),
    };
    const org = await db.$transaction(async (tx) => {
      const o = id ? await tx.organization.update({ where: { id }, data }) : await tx.organization.create({ data: { ...data, ownerId: user.id } });
      await tx.orgDomain.deleteMany({ where: { organizationId: o.id, domain: { notIn: domains } } });
      for (const domain of domains) await tx.orgDomain.upsert({ where: { domain }, create: { domain, organizationId: o.id }, update: {} });
      return o;
    });
    return `/organizations/${org.id}`;
  });
}

export async function saveAgreement(fd: FormData) {
  const organizationId = str(fd, "organizationId");
  await act(fd, `/organizations/${organizationId}`, async () => {
    const docUrl = opt(fd, "docUrl");
    if (docUrl && !/^https:\/\//i.test(docUrl)) throw new AppError("The Drive link must start with https://", 422);
    await db.partnerAgreement.create({
      data: {
        organizationId,
        type: oneOf<AgreementType>(L.agreementType, str(fd, "type"), "Relationship type"),
        status: oneOf<AgreementStatus>(L.agreementStatus, str(fd, "status") || "PROSPECT", "Status"),
        startDate: day(str(fd, "startDate")), endDate: day(str(fd, "endDate")), docUrl,
        brandName: opt(fd, "brandName"), territory: opt(fd, "territory"),
        pricingModel: optOneOf<PricingModel>(L.pricingModel, str(fd, "pricingModel"), "Pricing model"),
        minimumCommitments: opt(fd, "minimumCommitments"), endCustomers: opt(fd, "endCustomers"),
        rateCard: opt(fd, "rateCard"), ceiling: dollars(str(fd, "ceiling")), notes: opt(fd, "notes"),
      },
    });
  });
}

export async function removeAgreement(fd: FormData) {
  const organizationId = str(fd, "organizationId");
  await act(fd, `/organizations/${organizationId}`, async () => {
    await db.partnerAgreement.deleteMany({ where: { id: str(fd, "agreementId"), organizationId } });
  });
}

export async function saveVehicle(fd: FormData) {
  await act(fd, "/vehicles", async () => {
    const name = str(fd, "name");
    if (!name) throw new AppError("Vehicle name is required.", 422);
    const data = {
      name, type: opt(fd, "type"), agency: opt(fd, "agency"), number: opt(fd, "number"), ceiling: dollars(str(fd, "ceiling")),
      popStart: day(str(fd, "popStart")), popEnd: day(str(fd, "popEnd")), notes: opt(fd, "notes"),
    };
    const id = str(fd, "id");
    if (id) await db.contractVehicle.update({ where: { id }, data });
    else await db.contractVehicle.create({ data });
  });
}

// ---------- contacts ----------

export async function saveContact(fd: FormData) {
  const id = str(fd, "id");
  await act(fd, id ? `/contacts/${id}` : "/contacts/new", async (user) => {
    const firstName = str(fd, "firstName"), lastName = str(fd, "lastName");
    if (!firstName && !lastName) throw new AppError("Enter a first or last name.", 422);
    const emails = [...new Set(str(fd, "emails").toLowerCase().split(/[\s,;]+/).filter(Boolean))];
    for (const e of emails) if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(e)) throw new AppError(`"${e}" is not a valid email address.`, 422);
    const clash = await db.contactEmail.findMany({ where: { email: { in: emails }, ...(id ? { NOT: { contactId: id } } : {}) }, include: { contact: true } });
    if (clash.length) throw new AppError(clash.map((c) => `${c.email} already belongs to ${c.contact.firstName} ${c.contact.lastName}`).join("; ") + ".", 422);
    const list = (k: string) => [...new Set(str(fd, k).split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean))];
    const data = {
      firstName, lastName, title: opt(fd, "title"), organizationId: opt(fd, "organizationId"),
      phones: list("phones"), linkedin: opt(fd, "linkedin"), location: opt(fd, "location"), tags: list("tags"), notes: opt(fd, "notes"),
      status: oneOf<ContactStatus>(L.contactStatus, str(fd, "status") || "ACTIVE", "Status"),
    };
    const contact = await db.$transaction(async (tx) => {
      const c = id ? await tx.contact.update({ where: { id }, data }) : await tx.contact.create({ data: { ...data, ownerId: user.id, source: "MANUAL" } });
      await tx.contactEmail.deleteMany({ where: { contactId: c.id } });
      // The first address listed is the primary one.
      if (emails.length) await tx.contactEmail.createMany({ data: emails.map((email, i) => ({ email, contactId: c.id, isPrimary: i === 0 })) });
      return c;
    });
    return `/contacts/${contact.id}`;
  });
}

// ---------- admin ----------

export async function saveUser(fd: FormData) {
  await act(fd, "/admin/users", async () => {
    const admin = await requireAdmin();
    const id = str(fd, "userId");
    const role = oneOf<"ADMIN" | "MEMBER">(L.role, str(fd, "role"), "Role");
    const active = fd.get("active") === "1";
    if (id === admin.id && (role !== "ADMIN" || !active)) throw new AppError("You can't remove your own admin access.", 422);
    await db.user.update({ where: { id }, data: { role, active } });
  });
}
