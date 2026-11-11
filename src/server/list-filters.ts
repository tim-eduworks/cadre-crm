import type { ContactStatus, OrgType, Prisma } from "@prisma/client";

const ORG_TYPES = ["DOD", "FEDERAL_CIVILIAN", "SLED", "FOREIGN_GOVERNMENT", "COMMERCIAL", "ACADEMIC", "PARTNER_PRIME", "OTHER"];
const CONTACT_STATUSES = ["ACTIVE", "ARCHIVED", "DO_NOT_CONTACT"];

export function orgWhere(q: { q?: string; type?: string }): Prisma.OrganizationWhereInput {
  const term = q.q?.trim();
  return {
    ...(q.type && ORG_TYPES.includes(q.type) ? { type: q.type as OrgType } : {}),
    ...(term
      ? { OR: [{ name: { contains: term, mode: "insensitive" } }, { domains: { some: { domain: { contains: term.toLowerCase() } } } }] }
      : {}),
  };
}

/** Contacts default to active only; pass status=ALL for everything. */
export function contactWhere(q: { q?: string; status?: string; tag?: string }): Prisma.ContactWhereInput {
  const term = q.q?.trim();
  const status = q.status === "ALL" ? undefined : q.status && CONTACT_STATUSES.includes(q.status) ? q.status : "ACTIVE";
  const words = term ? term.split(/\s+/).slice(0, 4) : [];
  return {
    ...(status ? { status: status as ContactStatus } : {}),
    ...(q.tag ? { tags: { has: q.tag } } : {}),
    AND: words.map((w) => ({
      OR: [
        { firstName: { contains: w, mode: "insensitive" as const } },
        { lastName: { contains: w, mode: "insensitive" as const } },
        { emails: { some: { email: { contains: w.toLowerCase() } } } },
        { organization: { name: { contains: w, mode: "insensitive" as const } } },
      ],
    })),
  };
}
