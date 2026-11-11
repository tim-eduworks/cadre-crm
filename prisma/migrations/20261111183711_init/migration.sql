-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "OrgType" AS ENUM ('DOD', 'FEDERAL_CIVILIAN', 'SLED', 'FOREIGN_GOVERNMENT', 'COMMERCIAL', 'ACADEMIC', 'PARTNER_PRIME', 'OTHER');

-- CreateEnum
CREATE TYPE "Market" AS ENUM ('DEFENSE_DOD', 'FEDERAL_CIVILIAN', 'STATE_LOCAL', 'AVIATION', 'HEALTHCARE', 'MANUFACTURING', 'TECHNICAL_WORKFORCE', 'EDUCATION_TRAINING');

-- CreateEnum
CREATE TYPE "SharedDomainKind" AS ENUM ('UMBRELLA', 'PERSONAL', 'IGNORED');

-- CreateEnum
CREATE TYPE "ContactSource" AS ENUM ('INSIGHTLY_IMPORT', 'MANUAL', 'GMAIL_DISCOVERED');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DO_NOT_CONTACT');

-- CreateEnum
CREATE TYPE "TeamFunction" AS ENUM ('BD', 'SOLUTION_ENGINEERING', 'SME', 'PRODUCT', 'LEADERSHIP');

-- CreateEnum
CREATE TYPE "EngagementType" AS ENUM ('DIRECT', 'VIA_PARTNER', 'WHITE_LABEL', 'LE_SERVICES');

-- CreateEnum
CREATE TYPE "PartnerRole" AS ENUM ('CLIENT_FACING_PARTNER', 'WHITE_LABEL_LICENSEE', 'LE_SERVICES', 'PRIME', 'SUB', 'END_CUSTOMER');

-- CreateEnum
CREATE TYPE "StakeholderRole" AS ENUM ('ECONOMIC_BUYER', 'MISSION_OWNER', 'CHAMPION', 'TECHNICAL_BUYER', 'CYBERSECURITY', 'PROCUREMENT', 'END_USER', 'DATA_SYSTEM_OWNER', 'POTENTIAL_BLOCKER');

-- CreateEnum
CREATE TYPE "OppStatus" AS ENUM ('OPEN', 'ON_HOLD', 'WON', 'LOST', 'NO_BID');

-- CreateEnum
CREATE TYPE "Branch" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "EnvSubType" AS ENUM ('CUSTOMER_CLOUD', 'GOV_CLOUD', 'ON_PREM', 'HYBRID', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "ImpactLevel" AS ENUM ('IL2', 'IL4', 'IL5', 'IL6', 'OTHER');

-- CreateEnum
CREATE TYPE "ProcurementVehicle" AS ENUM ('SBIR_PHASE_III', 'OTA', 'COMPETITIVE_RFP', 'SOLE_SOURCE', 'GSA_SCHEDULE', 'CONTRACT_MOD', 'VIA_PRIME_PARTNER', 'COMMERCIAL_PO', 'OTHER');

-- CreateEnum
CREATE TYPE "ColorOfMoney" AS ENUM ('OM', 'RDTE', 'PROCUREMENT', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "FundingStatus" AS ENUM ('UNIDENTIFIED', 'IDENTIFIED', 'PROGRAMMED', 'APPROPRIATED', 'OBLIGATED');

-- CreateEnum
CREATE TYPE "TcvFlag" AS ENUM ('ESTIMATE', 'QUOTED', 'CONTRACTED');

-- CreateEnum
CREATE TYPE "GoDecision" AS ENUM ('GO', 'NO_GO');

-- CreateEnum
CREATE TYPE "ValidationType" AS ENUM ('DEMO_ONLY', 'GUIDED_EVALUATION', 'PROOF_OF_VALUE', 'PILOT');

-- CreateEnum
CREATE TYPE "ContractSubStatus" AS ENUM ('PRICING', 'PROPOSAL', 'PROCUREMENT', 'NEGOTIATION', 'SECURITY_LEGAL_REVIEW', 'AWARD');

-- CreateEnum
CREATE TYPE "RequirementTag" AS ENUM ('CONFIGURATION', 'CUSTOMIZATION', 'CORE_PRODUCT_CANDIDATE');

-- CreateEnum
CREATE TYPE "CriterionResult" AS ENUM ('MET', 'PARTIALLY', 'NOT_MET');

-- CreateEnum
CREATE TYPE "Criterion" AS ENUM ('PROBLEM_SEVERITY', 'CADRE_FIT', 'CHAMPION', 'DECISION_AUTHORITY', 'FUNDING', 'PROCUREMENT_PATH', 'TIMELINE', 'TECHNICAL_FEASIBILITY');

-- CreateEnum
CREATE TYPE "Rating" AS ENUM ('GREEN', 'YELLOW', 'RED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('EMAIL', 'MEETING', 'CALL', 'NOTE', 'DEMO', 'PROPOSAL_SUBMITTED', 'RFI_RFP_RESPONSE', 'CONFERENCE_TOUCH');

-- CreateEnum
CREATE TYPE "DocType" AS ENUM ('DISCOVERY_NOTES', 'QUALIFICATION', 'SOLUTION_DESIGN', 'SOW_DRAFT', 'FOLLOW_UP_SUMMARY', 'OTHER');

-- CreateEnum
CREATE TYPE "AgreementType" AS ENUM ('CLIENT_FACING_PARTNER', 'WHITE_LABEL_LICENSEE', 'LE_SERVICES');

-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('PROSPECT', 'NEGOTIATING', 'ACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PricingModel" AS ENUM ('PER_SEAT', 'PER_DEPLOYMENT', 'ROYALTY_PCT', 'FLAT_FEE');

-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('ACTIVE', 'RENEWING', 'LAPSED');

-- CreateEnum
CREATE TYPE "AuditKind" AS ENUM ('STAGE', 'GATE_OVERRIDE', 'STATUS', 'SCORECARD', 'TCV');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageConfig" (
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "gate" JSONB NOT NULL,
    "onExit" JSONB,

    CONSTRAINT "StageConfig_pkey" PRIMARY KEY ("number")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OrgType" NOT NULL DEFAULT 'OTHER',
    "market" "Market",
    "parentId" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgDomain" (
    "domain" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "OrgDomain_pkey" PRIMARY KEY ("domain")
);

-- CreateTable
CREATE TABLE "SharedDomain" (
    "domain" TEXT NOT NULL,
    "kind" "SharedDomainKind" NOT NULL,
    "label" TEXT,

    CONSTRAINT "SharedDomain_pkey" PRIMARY KEY ("domain")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL DEFAULT '',
    "title" TEXT,
    "organizationId" TEXT,
    "phones" TEXT[],
    "linkedin" TEXT,
    "location" TEXT,
    "tags" TEXT[],
    "notes" TEXT,
    "ownerId" TEXT,
    "lastTouchAt" TIMESTAMP(3),
    "source" "ContactSource" NOT NULL DEFAULT 'MANUAL',
    "status" "ContactStatus" NOT NULL DEFAULT 'ACTIVE',
    "importMeta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactEmail" (
    "email" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ContactEmail_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" TEXT,
    "ownerId" TEXT NOT NULL,
    "engagementType" "EngagementType" NOT NULL,
    "stage" INTEGER NOT NULL DEFAULT 1,
    "status" "OppStatus" NOT NULL DEFAULT 'OPEN',
    "holdReason" TEXT,
    "closeReason" TEXT,
    "contractSubStatus" "ContractSubStatus",
    "branch" "Branch",
    "envSubType" "EnvSubType",
    "impactLevel" "ImpactLevel",
    "atoStatus" TEXT,
    "procurementVehicle" "ProcurementVehicle",
    "contractVehicleId" TEXT,
    "fundingSource" TEXT,
    "colorOfMoney" "ColorOfMoney",
    "fundingFy" INTEGER,
    "fundingStatus" "FundingStatus",
    "tcv" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tcvFlag" "TcvFlag" NOT NULL DEFAULT 'ESTIMATE',
    "eduworksShare" DECIMAL(14,2),
    "awardQuarter" INTEGER,
    "awardFy" INTEGER,
    "problem" TEXT,
    "impact" TEXT,
    "desiredState" TEXT,
    "solution" TEXT,
    "goDecision" "GoDecision",
    "goRationale" TEXT,
    "designCapabilities" TEXT,
    "designServices" TEXT,
    "designData" TEXT,
    "designIntegrations" TEXT,
    "designConsulting" TEXT,
    "designApproach" TEXT,
    "validationType" "ValidationType",
    "validationOutcome" TEXT,
    "scopeSoftware" TEXT,
    "scopeUsers" TEXT,
    "scopeData" TEXT,
    "scopeIntegrations" TEXT,
    "scopeServices" TEXT,
    "scopeInfrastructure" TEXT,
    "scopeImplementation" TEXT,
    "scopeSupport" TEXT,
    "licenseCount" INTEGER,
    "deliveryOwnerId" TEXT,
    "kickoffDate" TIMESTAMP(3),
    "driveFolderId" TEXT,
    "driveFolderUrl" TEXT,
    "expandsLicenseId" TEXT,
    "lastTouchAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityTeamMember" (
    "opportunityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "function" "TeamFunction" NOT NULL,

    CONSTRAINT "OpportunityTeamMember_pkey" PRIMARY KEY ("opportunityId","userId")
);

-- CreateTable
CREATE TABLE "OpportunityPartner" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "PartnerRole" NOT NULL,
    "customerContactOwner" TEXT,
    "notes" TEXT,

    CONSTRAINT "OpportunityPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityStakeholder" (
    "opportunityId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "roles" "StakeholderRole"[],

    CONSTRAINT "OpportunityStakeholder_pkey" PRIMARY KEY ("opportunityId","contactId")
);

-- CreateTable
CREATE TABLE "SuccessCriterion" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "result" "CriterionResult",
    "evidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuccessCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolutionRequirement" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "tag" "RequirementTag",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolutionRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScorecardRating" (
    "opportunityId" TEXT NOT NULL,
    "criterion" "Criterion" NOT NULL,
    "rating" "Rating" NOT NULL DEFAULT 'UNKNOWN',
    "justification" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScorecardRating_pkey" PRIMARY KEY ("opportunityId","criterion")
);

-- CreateTable
CREATE TABLE "OpportunityDocument" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "type" "DocType" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "driveFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerAgreement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "AgreementType" NOT NULL,
    "status" "AgreementStatus" NOT NULL DEFAULT 'PROSPECT',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "docUrl" TEXT,
    "brandName" TEXT,
    "territory" TEXT,
    "pricingModel" "PricingModel",
    "minimumCommitments" TEXT,
    "endCustomers" TEXT,
    "rateCard" TEXT,
    "ceiling" DECIMAL(14,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractVehicle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "agency" TEXT,
    "number" TEXT,
    "ceiling" DECIMAL(14,2),
    "popStart" TIMESTAMP(3),
    "popEnd" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "ContractVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "License" (
    "id" TEXT NOT NULL,
    "customerOrgId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "viaPartnerOrgId" TEXT,
    "licenseCount" INTEGER,
    "branch" "Branch",
    "termStart" TIMESTAMP(3),
    "termEnd" TIMESTAMP(3),
    "renewalDate" TIMESTAMP(3),
    "value" DECIMAL(14,2),
    "status" "LicenseStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "License_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "subject" TEXT NOT NULL,
    "snippet" TEXT,
    "link" TEXT,
    "gmailThreadId" TEXT,
    "calendarEventId" TEXT,
    "problemFocused" BOOLEAN NOT NULL DEFAULT false,
    "opportunityId" TEXT,
    "organizationId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityParticipant" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "contactId" TEXT,
    "userId" TEXT,

    CONSTRAINT "ActivityParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "assigneeId" TEXT,
    "opportunityId" TEXT,
    "contactId" TEXT,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "kind" "AuditKind" NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "comment" TEXT,
    "userId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_name_key" ON "Organization"("name");

-- CreateIndex
CREATE INDEX "Organization_parentId_idx" ON "Organization"("parentId");

-- CreateIndex
CREATE INDEX "Contact_organizationId_idx" ON "Contact"("organizationId");

-- CreateIndex
CREATE INDEX "Contact_lastName_firstName_idx" ON "Contact"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "ContactEmail_contactId_idx" ON "ContactEmail"("contactId");

-- CreateIndex
CREATE INDEX "Opportunity_stage_status_idx" ON "Opportunity"("stage", "status");

-- CreateIndex
CREATE INDEX "Opportunity_organizationId_idx" ON "Opportunity"("organizationId");

-- CreateIndex
CREATE INDEX "Opportunity_ownerId_idx" ON "Opportunity"("ownerId");

-- CreateIndex
CREATE INDEX "OpportunityPartner_organizationId_idx" ON "OpportunityPartner"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityPartner_opportunityId_organizationId_role_key" ON "OpportunityPartner"("opportunityId", "organizationId", "role");

-- CreateIndex
CREATE INDEX "OpportunityStakeholder_contactId_idx" ON "OpportunityStakeholder"("contactId");

-- CreateIndex
CREATE INDEX "SuccessCriterion_opportunityId_idx" ON "SuccessCriterion"("opportunityId");

-- CreateIndex
CREATE INDEX "SolutionRequirement_opportunityId_idx" ON "SolutionRequirement"("opportunityId");

-- CreateIndex
CREATE INDEX "OpportunityDocument_opportunityId_idx" ON "OpportunityDocument"("opportunityId");

-- CreateIndex
CREATE INDEX "PartnerAgreement_organizationId_idx" ON "PartnerAgreement"("organizationId");

-- CreateIndex
CREATE INDEX "License_renewalDate_idx" ON "License"("renewalDate");

-- CreateIndex
CREATE INDEX "Activity_opportunityId_occurredAt_idx" ON "Activity"("opportunityId", "occurredAt");

-- CreateIndex
CREATE INDEX "Activity_organizationId_occurredAt_idx" ON "Activity"("organizationId", "occurredAt");

-- CreateIndex
CREATE INDEX "ActivityParticipant_contactId_idx" ON "ActivityParticipant"("contactId");

-- CreateIndex
CREATE INDEX "ActivityParticipant_activityId_idx" ON "ActivityParticipant"("activityId");

-- CreateIndex
CREATE INDEX "Task_assigneeId_done_dueDate_idx" ON "Task"("assigneeId", "done", "dueDate");

-- CreateIndex
CREATE INDEX "Task_opportunityId_idx" ON "Task"("opportunityId");

-- CreateIndex
CREATE INDEX "AuditLog_opportunityId_at_idx" ON "AuditLog"("opportunityId", "at");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgDomain" ADD CONSTRAINT "OrgDomain_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactEmail" ADD CONSTRAINT "ContactEmail_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_contractVehicleId_fkey" FOREIGN KEY ("contractVehicleId") REFERENCES "ContractVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_deliveryOwnerId_fkey" FOREIGN KEY ("deliveryOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_expandsLicenseId_fkey" FOREIGN KEY ("expandsLicenseId") REFERENCES "License"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityTeamMember" ADD CONSTRAINT "OpportunityTeamMember_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityTeamMember" ADD CONSTRAINT "OpportunityTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityPartner" ADD CONSTRAINT "OpportunityPartner_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityPartner" ADD CONSTRAINT "OpportunityPartner_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityStakeholder" ADD CONSTRAINT "OpportunityStakeholder_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityStakeholder" ADD CONSTRAINT "OpportunityStakeholder_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuccessCriterion" ADD CONSTRAINT "SuccessCriterion_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolutionRequirement" ADD CONSTRAINT "SolutionRequirement_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScorecardRating" ADD CONSTRAINT "ScorecardRating_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityDocument" ADD CONSTRAINT "OpportunityDocument_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerAgreement" ADD CONSTRAINT "PartnerAgreement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "License" ADD CONSTRAINT "License_customerOrgId_fkey" FOREIGN KEY ("customerOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "License" ADD CONSTRAINT "License_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "License" ADD CONSTRAINT "License_viaPartnerOrgId_fkey" FOREIGN KEY ("viaPartnerOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityParticipant" ADD CONSTRAINT "ActivityParticipant_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityParticipant" ADD CONSTRAINT "ActivityParticipant_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityParticipant" ADD CONSTRAINT "ActivityParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
