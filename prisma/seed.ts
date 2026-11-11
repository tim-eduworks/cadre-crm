/**
 * Dev seed: realistic but entirely fictional data. Never put real contacts here.
 * Wipes the pipeline tables first, so only run it against a dev database.
 */
import { PrismaClient, Prisma, type Criterion, type Rating } from "@prisma/client";
import { seedConfig } from "./seed-config";

const db = new PrismaClient();
const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);
const CRITERIA: Criterion[] = ["PROBLEM_SEVERITY", "CADRE_FIT", "CHAMPION", "DECISION_AUTHORITY", "FUNDING", "PROCUREMENT_PATH", "TIMELINE", "TECHNICAL_FEASIBILITY"];

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed a production database.");
  await seedConfig(db, true);
  // Order matters for FKs.
  await db.$transaction([
    db.auditLog.deleteMany(), db.task.deleteMany(), db.activity.deleteMany(), db.license.deleteMany(), db.opportunity.deleteMany(),
    db.partnerAgreement.deleteMany(), db.contractVehicle.deleteMany(), db.contact.deleteMany(), db.organization.deleteMany(), db.sharedDomain.deleteMany(),
  ]);

  const user = (email: string, name: string, role: "ADMIN" | "MEMBER") =>
    db.user.upsert({ where: { email }, update: { name, role, active: true }, create: { email, name, role } });
  const admin = await user("dev.admin@eduworks.com", "Dana Admin (dev)", "ADMIN");
  const se = await user("dev.se@eduworks.com", "Sam Engineer (dev)", "MEMBER");
  const bd = await user("dev.bd@eduworks.com", "Blake Bizdev (dev)", "MEMBER");

  await db.sharedDomain.createMany({
    data: [
      { domain: "mail.example", kind: "UMBRELLA", label: "Fictional shared defense mail" },
      { domain: "freemail.example", kind: "PERSONAL" },
    ],
  });

  const org = (name: string, type: Prisma.OrganizationCreateInput["type"], market: Prisma.OrganizationCreateInput["market"], domain?: string, parentId?: string) =>
    db.organization.create({ data: { name, type, market, parentId, ownerId: admin.id, domains: domain ? { create: { domain } } : undefined } });
  const fleet = await org("Meridian Fleet Command (fictional)", "DOD", "DEFENSE_DOD", "fleet.example");
  const training = await org("Meridian Fleet Training Group", "DOD", "DEFENSE_DOD", "training.fleet.example", fleet.id);
  const simCenter = await org("Harbor Simulation Center", "DOD", "DEFENSE_DOD", "simcenter.fleet.example", training.id);
  const aviation = await org("Northfield Aviation Authority", "FEDERAL_CIVILIAN", "AVIATION", "northfield-aviation.example");
  const state = await org("State of Avalon Workforce Board", "SLED", "STATE_LOCAL", "avalon-workforce.example");
  const health = await org("Lakeshore Health System", "COMMERCIAL", "HEALTHCARE", "lakeshore-health.example");
  const mfg = await org("Ironbridge Manufacturing", "COMMERCIAL", "MANUFACTURING", "ironbridge.example");
  const college = await org("Cedar Valley Technical College", "ACADEMIC", "EDUCATION_TRAINING", "cedarvalley.example");
  const allied = await org("Southern Isles Navy (fictional)", "FOREIGN_GOVERNMENT", "DEFENSE_DOD", "navy.southernisles.example");
  const vrPartner = await org("BrightDeck VR", "PARTNER_PRIME", "TECHNICAL_WORKFORCE", "brightdeck.example");
  const prime = await org("Halcyon Systems Integrators", "PARTNER_PRIME", "DEFENSE_DOD", "halcyon-si.example");
  const lms = await org("Coursewright Learning", "PARTNER_PRIME", "EDUCATION_TRAINING", "coursewright.example");

  let n = 0;
  const contact = async (orgRow: { id: string; domains?: unknown }, domain: string, first: string, last: string, title: string, touchDays?: number) => {
    n++;
    return db.contact.create({
      data: {
        firstName: first, lastName: last, title, organizationId: orgRow.id, ownerId: n % 2 ? admin.id : bd.id, source: "MANUAL",
        lastTouchAt: touchDays === undefined ? null : ago(touchDays),
        emails: { create: { email: `${first}.${last}@${domain}`.toLowerCase(), isPrimary: true } },
      },
    });
  };
  const c = {
    reyes: await contact(training, "training.fleet.example", "Morgan", "Reyes", "Director of Training Readiness", 3),
    okafor: await contact(training, "training.fleet.example", "Chidi", "Okafor", "Program Analyst", 12),
    lind: await contact(simCenter, "simcenter.fleet.example", "Astrid", "Lind", "Simulation Lead", 40),
    patel: await contact(fleet, "fleet.example", "Ravi", "Patel", "Contracting Officer", 20),
    nguyen: await contact(aviation, "northfield-aviation.example", "Linh", "Nguyen", "Chief Learning Officer", 5),
    brooks: await contact(aviation, "northfield-aviation.example", "Terrence", "Brooks", "ISSO", 5),
    alvarez: await contact(state, "avalon-workforce.example", "Sofia", "Alvarez", "Workforce Programs Manager", 50),
    kim: await contact(health, "lakeshore-health.example", "Jae", "Kim", "VP Clinical Education", 8),
    weber: await contact(mfg, "ironbridge.example", "Hanna", "Weber", "Plant Training Manager", 2),
    tane: await contact(allied, "navy.southernisles.example", "Wiremu", "Tane", "Commander, Fleet Personnel", 15),
    shaw: await contact(vrPartner, "brightdeck.example", "Priya", "Shaw", "Head of Partnerships", 6),
    dorsey: await contact(prime, "halcyon-si.example", "Elliot", "Dorsey", "Capture Manager", 9),
    marsh: await contact(lms, "coursewright.example", "Greta", "Marsh", "CEO", 30),
    ortiz: await contact(college, "cedarvalley.example", "Luis", "Ortiz", "Dean of Workforce Programs"),
  };

  const vehicle = await db.contractVehicle.create({
    data: { name: "Training Systems OTA (fictional)", type: "OTA", agency: "Meridian Fleet Command", number: "MFC-OTA-0042", ceiling: 25_000_000, popStart: ago(400), popEnd: ago(-700) },
  });
  await db.partnerAgreement.createMany({
    data: [
      { organizationId: vrPartner.id, type: "CLIENT_FACING_PARTNER", status: "ACTIVE", startDate: ago(200), endDate: ago(-530), notes: "Teaming agreement for allied navy pursuits" },
      { organizationId: lms.id, type: "WHITE_LABEL_LICENSEE", status: "NEGOTIATING", brandName: "Coursewright Skills Graph", territory: "North America, higher ed", pricingModel: "ROYALTY_PCT", minimumCommitments: "500 seats in year 1" },
      { organizationId: prime.id, type: "LE_SERVICES", status: "ACTIVE", rateCard: "Labor categories per teaming agreement", ceiling: 750_000 },
    ],
  });

  type Card = Partial<Record<Criterion, Rating>>;
  const scorecard = (all: Rating, over: Card = {}, ageDays = 10) =>
    CRITERIA.map((criterion) => {
      const rating = over[criterion] ?? all;
      return { criterion, rating, justification: rating === "UNKNOWN" ? null : `${rating.toLowerCase()} per latest discussion`, updatedAt: ago(ageDays) };
    });

  const design = { designCapabilities: "Competency framework management, skills gap analytics", designServices: "Onboarding and admin training", designData: "Existing job-task analysis exports", designIntegrations: "LMS via xAPI; HR system nightly sync", designConsulting: "Competency model refinement workshops", designApproach: "Phased rollout: pilot unit, then full command" };
  const scope = { scopeSoftware: "CADRE platform, standard modules", scopeUsers: "Training managers and instructors", scopeData: "Three competency frameworks, 5 years of records", scopeIntegrations: "LMS and HR system", scopeServices: "120 hours onboarding", scopeInfrastructure: "Hosted per deployment branch", scopeImplementation: "12-week implementation", scopeSupport: "Standard support, named CSM" };

  type Seed = {
    name: string; org: { id: string }; owner: { id: string }; stage: number; tcv: number; touch?: number;
    data?: Partial<Prisma.OpportunityUncheckedCreateInput>; card: ReturnType<typeof scorecard>;
    stakeholders?: [{ id: string }, Prisma.OpportunityStakeholderCreateWithoutOpportunityInput["roles"]][];
    next?: { title: string; due: number; who?: { id: string } } | null;
  };
  const make = async (s: Seed) => {
    const st = s.stage;
    const opp = await db.opportunity.create({
      data: {
        name: s.name, organizationId: s.org.id, ownerId: s.owner.id, engagementType: "DIRECT", stage: st, tcv: s.tcv,
        lastTouchAt: s.touch === undefined ? null : ago(s.touch), createdAt: ago(60 + st * 30),
        problem: "Training managers cannot see which competencies each unit is missing until after an evaluation fails.",
        impact: "Readiness gaps surface late; remediation costs time and requalification cycles.",
        ...(st >= 2 ? { desiredState: "A current, shared view of competency gaps by unit, updated as training completes." } : {}),
        ...(st >= 3 ? { solution: "CADRE competency framework with gap analytics fed by existing training records." } : {}),
        ...(st >= 4 ? { goDecision: "GO", goRationale: "Clear problem owner, funded line, good fit.", procurementVehicle: "OTA", fundingSource: "Training modernization line", colorOfMoney: "OM", fundingFy: 2027, fundingStatus: "PROGRAMMED" } : {}),
        ...(st >= 5 ? design : {}),
        ...(st >= 6 ? { branch: "B" } : {}),
        ...(st >= 8 ? { validationType: "PROOF_OF_VALUE", validationOutcome: "Pilot unit identified 14 gaps in the first week; sponsor asked for scope." } : {}),
        ...(st >= 9 ? { ...scope, licenseCount: 250, tcvFlag: "QUOTED", contractSubStatus: "NEGOTIATION" } : {}),
        ...(st >= 10 ? { tcvFlag: "CONTRACTED", contractSubStatus: "AWARD", status: "WON" } : {}),
        ...s.data,
        scorecard: { create: s.card },
        stakeholders: { create: (s.stakeholders ?? []).map(([ct, roles]) => ({ contactId: ct.id, roles })) },
        successCriteria: st >= 2 ? { create: [{ text: "Gap report available for every unit within 24 hours of course completion" }, { text: "Reduce requalification events by 20% in year one" }] } : undefined,
        requirements: st >= 4 ? { create: [{ text: "Import existing job-task analysis", tag: st >= 5 ? "CONFIGURATION" : null }, { text: "Nightly HR sync", tag: st >= 5 ? "CUSTOMIZATION" : null }] } : undefined,
        documents: st >= 3 ? { create: { type: "DISCOVERY_NOTES", title: "Discovery notes", url: "https://docs.google.com/document/d/EXAMPLE-NOT-A-REAL-DOC" } } : undefined,
        tasks: s.next === null ? undefined : { create: { title: s.next?.title ?? "Follow up with champion", dueDate: ago(-(s.next?.due ?? 5)), assigneeId: (s.next?.who ?? s.owner).id, isPrimary: true } },
      },
    });
    const first = s.stakeholders?.[0]?.[0];
    const act = (type: "MEETING" | "DEMO" | "CALL", subject: string, days: number, problemFocused = false) =>
      db.activity.create({
        data: { type, subject, occurredAt: ago(days), problemFocused, opportunityId: opp.id, organizationId: s.org.id, createdById: s.owner.id,
          participants: { create: [{ userId: s.owner.id }, ...(first ? [{ contactId: first.id }] : [])] } },
      });
    if (st >= 2) await act("CALL", "Intro call", (s.touch ?? 0) + 40);
    if (st >= 3) await act("MEETING", "Discovery session", (s.touch ?? 0) + 25);
    if (st >= 7) await act("DEMO", "Problem-focused demo: competency gap view", (s.touch ?? 0) + 10, true);
    await db.auditLog.create({ data: { opportunityId: opp.id, userId: s.owner.id, kind: "STAGE", oldValue: "—", newValue: `${st}`, comment: "Seeded", at: ago(s.touch ?? 1) } });
    return opp;
  };

  await make({ name: "Simulator instructor competency tracking", org: simCenter, owner: bd, stage: 1, tcv: 180_000, touch: 40, card: scorecard("UNKNOWN", { PROBLEM_SEVERITY: "YELLOW" }), stakeholders: [[c.lind, ["CHAMPION", "END_USER"]]], next: { title: "Book discovery call with simulation lead", due: -6 } });
  await make({ name: "Apprenticeship skills framework", org: state, owner: admin, stage: 1, tcv: 90_000, touch: 50, card: scorecard("UNKNOWN"), next: null, data: { impact: null } });
  await make({ name: "Clinical educator competency model", org: health, owner: bd, stage: 2, tcv: 320_000, touch: 8, card: scorecard("UNKNOWN", { PROBLEM_SEVERITY: "GREEN", CADRE_FIT: "YELLOW", CHAMPION: "GREEN" }), stakeholders: [[c.kim, ["ECONOMIC_BUYER", "CHAMPION"]]], next: { title: "Send discovery notes for review", due: 3 } });
  await make({ name: "Technician upskilling pathways", org: mfg, owner: se, stage: 3, tcv: 240_000, touch: 2, card: scorecard("YELLOW", { PROBLEM_SEVERITY: "GREEN", FUNDING: "UNKNOWN", TIMELINE: "UNKNOWN" }), stakeholders: [[c.weber, ["MISSION_OWNER", "CHAMPION"]]], next: { title: "Confirm budget owner for FY27", due: 4 } });
  await make({ name: "Program-wide workforce analytics", org: college, owner: admin, stage: 3, tcv: 60_000, card: scorecard("YELLOW", { FUNDING: "RED", DECISION_AUTHORITY: "RED" }), stakeholders: [[c.ortiz, ["CHAMPION"]]], next: { title: "Qualify funding source", due: -2 }, data: { status: "ON_HOLD", holdReason: "Awaiting funding" } });
  await make({ name: "Air traffic trainee competency records", org: aviation, owner: admin, stage: 4, tcv: 1_400_000, touch: 5, card: scorecard("GREEN", { TIMELINE: "YELLOW", TECHNICAL_FEASIBILITY: "YELLOW" }), stakeholders: [[c.nguyen, ["ECONOMIC_BUYER", "MISSION_OWNER"]], [c.brooks, ["CYBERSECURITY", "POTENTIAL_BLOCKER"]]], next: { title: "Draft solution design with SE", due: 6, who: se }, data: { awardQuarter: 3, awardFy: 2027, procurementVehicle: "COMPETITIVE_RFP" } });
  await make({ name: "Fleet training readiness dashboard", org: training, owner: admin, stage: 5, tcv: 2_100_000, touch: 3, card: scorecard("GREEN", { PROCUREMENT_PATH: "YELLOW", CHAMPION: "GREEN" }, 120), stakeholders: [[c.reyes, ["ECONOMIC_BUYER", "CHAMPION"]], [c.okafor, ["TECHNICAL_BUYER", "DATA_SYSTEM_OWNER"]], [c.patel, ["PROCUREMENT"]]], next: { title: "Decide deployment branch with ISSM", due: 2 }, data: { contractVehicleId: vehicle.id, awardQuarter: 2, awardFy: 2027 } });
  await make({ name: "Five-ship crew competency rollout", org: allied, owner: bd, stage: 6, tcv: 3_600_000, touch: 15, card: scorecard("GREEN", { TIMELINE: "RED", PROCUREMENT_PATH: "YELLOW" }), stakeholders: [[c.tane, ["ECONOMIC_BUYER"]], [c.shaw, ["CHAMPION"]]], next: { title: "Schedule problem-focused demo via partner", due: 7 },
    data: { engagementType: "VIA_PARTNER", eduworksShare: 1_500_000, branch: "C", envSubType: "CUSTOMER_CLOUD", impactLevel: "OTHER", atoStatus: "Partner-led accreditation in progress", procurementVehicle: "VIA_PRIME_PARTNER", partners: { create: { organizationId: vrPartner.id, role: "CLIENT_FACING_PARTNER", customerContactOwner: "BrightDeck VR account lead" } } } });
  await make({ name: "White-label skills graph license", org: lms, owner: admin, stage: 7, tcv: 800_000, touch: 30, card: scorecard("GREEN", { FUNDING: "YELLOW", DECISION_AUTHORITY: "GREEN" }), stakeholders: [[c.marsh, ["ECONOMIC_BUYER", "CHAMPION"]]], next: { title: "Agree proof-of-value success measures", due: 1 }, data: { engagementType: "WHITE_LABEL", branch: "A", procurementVehicle: "COMMERCIAL_PO" } });
  await make({ name: "Maintenance training needs analysis", org: fleet, owner: se, stage: 8, tcv: 450_000, touch: 9, card: scorecard("GREEN", { FUNDING: "RED", TIMELINE: "RED" }), stakeholders: [[c.dorsey, ["CHAMPION"]], [c.patel, ["PROCUREMENT"]]], next: { title: "Complete scope with prime", due: 5 },
    data: { engagementType: "LE_SERVICES", status: "ON_HOLD", holdReason: "CR", partners: { create: { organizationId: prime.id, role: "PRIME" } } } });
  await make({ name: "Instructor qualification tracking", org: training, owner: admin, stage: 9, tcv: 1_250_000, touch: 1, card: scorecard("GREEN"), stakeholders: [[c.reyes, ["ECONOMIC_BUYER"]], [c.patel, ["PROCUREMENT"]]], next: { title: "Return redlines on terms", due: 2 }, data: { contractVehicleId: vehicle.id, awardQuarter: 1, awardFy: 2027, fundingStatus: "APPROPRIATED" } });
  const won = await make({ name: "Line supervisor competency pilot", org: mfg, owner: se, stage: 10, tcv: 150_000, touch: 4, card: scorecard("GREEN"), stakeholders: [[c.weber, ["ECONOMIC_BUYER", "CHAMPION"]]], next: { title: "Hold kickoff", due: 3, who: se }, data: { branch: "A", procurementVehicle: "COMMERCIAL_PO", awardQuarter: 1, awardFy: 2027, fundingStatus: "OBLIGATED" } });
  await db.task.create({ data: { title: "Prepare onboarding data checklist", dueDate: ago(-10), assigneeId: se.id, opportunityId: won.id } });
  await make({ name: "Nurse residency competency mapping", org: health, owner: bd, stage: 4, tcv: 200_000, touch: 70, card: scorecard("YELLOW", { CHAMPION: "RED" }), stakeholders: [[c.kim, ["ECONOMIC_BUYER"]]], next: { title: "Close out", due: -30 }, data: { status: "LOST", closeReason: "Chose incumbent LMS add-on" } });

  console.log("Seeded fictional dev data: 3 users, 12 orgs, 14 contacts, 13 opportunities.");
}

main().finally(() => db.$disconnect());
