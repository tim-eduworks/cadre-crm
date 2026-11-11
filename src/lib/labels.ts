import type { Criterion } from "@/domain/types";

export const L = {
  orgType: {
    DOD: "DoD", FEDERAL_CIVILIAN: "Federal civilian", SLED: "SLED", FOREIGN_GOVERNMENT: "Foreign government",
    COMMERCIAL: "Commercial", ACADEMIC: "Academic", PARTNER_PRIME: "Partner/Prime", OTHER: "Other",
  },
  market: {
    DEFENSE_DOD: "Defense/DoD", FEDERAL_CIVILIAN: "Federal civilian", STATE_LOCAL: "State/local", AVIATION: "Aviation",
    HEALTHCARE: "Healthcare", MANUFACTURING: "Manufacturing", TECHNICAL_WORKFORCE: "Technical workforce",
    EDUCATION_TRAINING: "Education/training providers",
  },
  contactStatus: { ACTIVE: "Active", ARCHIVED: "Archived", DO_NOT_CONTACT: "Do not contact" },
  contactSource: { INSIGHTLY_IMPORT: "Insightly import", MANUAL: "Manual", GMAIL_DISCOVERED: "Gmail discovered" },
  teamFunction: { BD: "BD", SOLUTION_ENGINEERING: "Solution Engineering", SME: "Competency/Training SME", PRODUCT: "Product", LEADERSHIP: "Leadership" },
  engagementType: { DIRECT: "Direct", VIA_PARTNER: "Via client-facing partner", WHITE_LABEL: "White-label license", LE_SERVICES: "Learning engineering services" },
  partnerRole: {
    CLIENT_FACING_PARTNER: "Client-facing partner", WHITE_LABEL_LICENSEE: "White-label licensee", LE_SERVICES: "Learning engineering services",
    PRIME: "Prime", SUB: "Sub", END_CUSTOMER: "End customer",
  },
  stakeholderRole: {
    ECONOMIC_BUYER: "Economic buyer", MISSION_OWNER: "Mission/business owner", CHAMPION: "Champion", TECHNICAL_BUYER: "Technical buyer",
    CYBERSECURITY: "Cybersecurity", PROCUREMENT: "Procurement", END_USER: "End user", DATA_SYSTEM_OWNER: "Data/system owner",
    POTENTIAL_BLOCKER: "Potential blocker",
  },
  status: { OPEN: "Open", ON_HOLD: "On hold", WON: "Won", LOST: "Lost", NO_BID: "No-bid" },
  branch: { A: "A · Self-service SaaS", B: "B · Sales-supported SaaS", C: "C · SLED/Federal customer environment" },
  envSubType: { CUSTOMER_CLOUD: "Customer cloud", GOV_CLOUD: "Gov cloud", ON_PREM: "On-prem", HYBRID: "Hybrid", RESTRICTED: "Restricted/disconnected" },
  impactLevel: { IL2: "IL2", IL4: "IL4", IL5: "IL5", IL6: "IL6", OTHER: "Other" },
  procurementVehicle: {
    SBIR_PHASE_III: "SBIR Phase III", OTA: "OTA", COMPETITIVE_RFP: "Competitive RFP", SOLE_SOURCE: "Sole source", GSA_SCHEDULE: "GSA/schedule",
    CONTRACT_MOD: "Existing contract mod", VIA_PRIME_PARTNER: "Via prime/partner", COMMERCIAL_PO: "Commercial PO", OTHER: "Other",
  },
  colorOfMoney: { OM: "O&M", RDTE: "RDT&E", PROCUREMENT: "Procurement", OTHER: "Other", UNKNOWN: "Unknown" },
  fundingStatus: { UNIDENTIFIED: "Unidentified", IDENTIFIED: "Identified", PROGRAMMED: "Programmed", APPROPRIATED: "Appropriated", OBLIGATED: "Obligated" },
  tcvFlag: { ESTIMATE: "Estimate", QUOTED: "Quoted", CONTRACTED: "Contracted" },
  goDecision: { GO: "Go", NO_GO: "No-go" },
  validationType: { DEMO_ONLY: "Demo only", GUIDED_EVALUATION: "Guided evaluation", PROOF_OF_VALUE: "Proof of value", PILOT: "Pilot" },
  contractSubStatus: {
    PRICING: "Pricing", PROPOSAL: "Proposal", PROCUREMENT: "Procurement", NEGOTIATION: "Negotiation",
    SECURITY_LEGAL_REVIEW: "Security/legal review", AWARD: "Award",
  },
  requirementTag: { CONFIGURATION: "Configuration", CUSTOMIZATION: "Customization", CORE_PRODUCT_CANDIDATE: "Core product candidate" },
  criterionResult: { MET: "Met", PARTIALLY: "Partially met", NOT_MET: "Not met" },
  rating: { GREEN: "Green", YELLOW: "Yellow", RED: "Red", UNKNOWN: "Unknown" },
  activityType: {
    EMAIL: "Email", MEETING: "Meeting", CALL: "Call", NOTE: "Note", DEMO: "Demo", PROPOSAL_SUBMITTED: "Proposal submitted",
    RFI_RFP_RESPONSE: "RFI/RFP response", CONFERENCE_TOUCH: "Conference touch",
  },
  docType: {
    DISCOVERY_NOTES: "Discovery notes", QUALIFICATION: "Qualification document", SOLUTION_DESIGN: "Solution design",
    SOW_DRAFT: "SOW draft", FOLLOW_UP_SUMMARY: "Follow-up summary", OTHER: "Other",
  },
  auditKind: { STAGE: "Stage", GATE_OVERRIDE: "Gate override", STATUS: "Status", SCORECARD: "Scorecard", TCV: "TCV" },
  agreementType: { CLIENT_FACING_PARTNER: "Client-facing partner", WHITE_LABEL_LICENSEE: "White-label licensee", LE_SERVICES: "Learning engineering services" },
  agreementStatus: { PROSPECT: "Prospect", NEGOTIATING: "Negotiating", ACTIVE: "Active", EXPIRED: "Expired" },
  pricingModel: { PER_SEAT: "Per-seat", PER_DEPLOYMENT: "Per-deployment", ROYALTY_PCT: "Royalty %", FLAT_FEE: "Flat fee" },
  licenseStatus: { ACTIVE: "Active", RENEWING: "Renewing", LAPSED: "Lapsed" },
  role: { ADMIN: "Admin", MEMBER: "Member" },
} as const;

export const CRITERION_LABEL: Record<Criterion, string> = {
  PROBLEM_SEVERITY: "Problem severity", CADRE_FIT: "CADRE fit", CHAMPION: "Champion", DECISION_AUTHORITY: "Decision authority",
  FUNDING: "Funding", PROCUREMENT_PATH: "Procurement path", TIMELINE: "Timeline", TECHNICAL_FEASIBILITY: "Technical feasibility",
};

export function label(map: Record<string, string>, key: string | null | undefined, empty = "—"): string {
  return key ? (map[key] ?? key) : empty;
}
