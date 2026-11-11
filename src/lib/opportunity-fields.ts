import { L } from "./labels";

export type FieldKind = "text" | "textarea" | "enum" | "int" | "money" | "date" | "user" | "org" | "vehicle";
export type FieldDef = { name: string; label: string; kind: FieldKind; options?: Record<string, string>; required?: boolean; hint?: string };

const t = (name: string, label: string, hint?: string): FieldDef => ({ name, label, kind: "textarea", hint });
const e = (name: string, label: string, options: Record<string, string>): FieldDef => ({ name, label, kind: "enum", options });

/** Editable opportunity fields, grouped by the section of the page they appear in. Server-side whitelist too. */
export const SECTIONS = {
  basics: [
    { name: "name", label: "Opportunity name", kind: "text", required: true },
    { name: "organizationId", label: "Customer organization", kind: "org" },
    { name: "ownerId", label: "Owner", kind: "user", required: true },
    { ...e("engagementType", "Engagement type", L.engagementType), required: true },
  ],
  value: [
    { name: "tcv", label: "Total Contract Value (USD)", kind: "money", required: true },
    { ...e("tcvFlag", "TCV basis", L.tcvFlag), required: true },
    { name: "eduworksShare", label: "Eduworks' share of TCV (USD)", kind: "money" },
  ],
  procurement: [
    e("procurementVehicle", "Procurement vehicle", L.procurementVehicle),
    { name: "contractVehicleId", label: "Contract vehicle record", kind: "vehicle" },
    { name: "fundingSource", label: "Funding source / program", kind: "text" },
    e("colorOfMoney", "Color of money", L.colorOfMoney),
    { name: "fundingFy", label: "FY of funds", kind: "int", hint: "e.g. 2027" },
    e("fundingStatus", "Funding status", L.fundingStatus),
  ],
  deployment: [
    e("branch", "Deployment branch", L.branch),
    e("envSubType", "Environment (branch C)", L.envSubType),
    e("impactLevel", "Impact level (branch C)", L.impactLevel),
    { name: "atoStatus", label: "ATO status (branch C)", kind: "text" },
  ],
  problem: [t("problem", "Problem"), t("impact", "Impact"), t("desiredState", "Desired state"), t("solution", "Solution")],
  qualification: [e("goDecision", "Go / no-go decision", L.goDecision), t("goRationale", "Rationale")],
  design: [
    t("designCapabilities", "CADRE capabilities"), t("designServices", "Services"), t("designData", "Data"),
    t("designIntegrations", "Integrations"), t("designConsulting", "Competency/training consulting"), t("designApproach", "Implementation approach"),
  ],
  validation: [e("validationType", "Validation type", L.validationType), t("validationOutcome", "Outcome")],
  scope: [
    t("scopeSoftware", "Software"), t("scopeUsers", "Users"), t("scopeData", "Data"), t("scopeIntegrations", "Integrations"),
    t("scopeServices", "Services"), t("scopeInfrastructure", "Infrastructure"), t("scopeImplementation", "Implementation"), t("scopeSupport", "Support"),
    { name: "licenseCount", label: "License count", kind: "int" },
  ],
  contract: [e("contractSubStatus", "Contract sub-status", L.contractSubStatus)],
  handoff: [
    { name: "deliveryOwnerId", label: "Delivery owner", kind: "user" },
    { name: "kickoffDate", label: "Kickoff held on", kind: "date" },
  ],
} satisfies Record<string, FieldDef[]>;

export type SectionKey = keyof typeof SECTIONS;
export const ALL_FIELDS: FieldDef[] = Object.values(SECTIONS).flat();
export const FIELD_BY_NAME = new Map(ALL_FIELDS.map((f) => [f.name, f]));
