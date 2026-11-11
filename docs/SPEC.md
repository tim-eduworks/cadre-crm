# Build: CADRE Pipeline & Contacts (internal CRM for Eduworks)

You are building a small internal web app that replaces Insightly for managing CADRE sales and contacts at Eduworks Corporation. Read this whole spec, then propose a plan and file layout before writing code. Build in the phases at the end; stop after each phase so I can review.

## 1. Why this exists

Insightly fails us in two ways:
1. **Pipeline is driven by P-win %.** Government deals don't fit a single probability. Cycles are long and unpredictable, funding and procurement path matter more than "likelihood," and deals stall for months on appropriations.
2. **Work is expected to happen inside the CRM.** We live in Gmail, Google Calendar, Google Docs and Drive. The CRM must sit on top of those, not replace them.

The new tool tracks opportunities through our CADRE Sales Playbook's 12-step motion using stage gates and an 8-criteria qualification scorecard, and pulls activity from Google Workspace automatically.

## 2. Users and access

- 2–5 users (BD/Sales plus Solution Engineering and SME contributors). All see the shared pipeline.
- Login with Google SSO, restricted to the `eduworks.com` Workspace domain.
- Roles: `admin` (manage users, templates, settings, imports) and `member` (everything else). No record-level permissions in v1.
- Every record has an `owner` (a user). Opportunities may also have additional `team members` with a function tag: BD, Solution Engineering, Competency/Training SME, Product, Leadership.

## 3. Tech stack (defaults — tell me if you'd change any and why)

- TypeScript, Next.js (App Router), Postgres, Prisma, Tailwind.
- Auth: Auth.js (NextAuth) with Google provider; hosted-domain check on `eduworks.com`.
- Google APIs: Gmail (read-only), Calendar (read-only), Drive, Docs. Configure the OAuth app as **Internal** to the Workspace so restricted scopes don't need Google verification. Each user grants their own consent; store refresh tokens encrypted at rest.
- Background jobs: a simple job runner (e.g., pg-boss on Postgres) for Gmail/Calendar sync. No Redis.
- Hosting: Google Cloud Run + Cloud SQL Postgres, secrets in Secret Manager. Keep all hosting config in env vars so it can move to AWS/Azure. Include a Dockerfile and a `docker compose` setup for local dev.
- No AI/LLM features in v1.
- Tests: Vitest for domain logic (stage gates, scorecard, forecasting, import cleaning); Playwright smoke test for the pipeline board.

## 4. Data model

### Organization
- name, type: `DoD`, `Federal civilian`, `SLED`, `Foreign government`, `Commercial`, `Academic`, `Partner/Prime`, `Other`
- market (from Playbook §4): Defense/DoD, Federal civilian, State/local, Aviation, Healthcare, Manufacturing, Technical workforce, Education/training providers
- `parent_org_id` for hierarchy (e.g., U.S. Navy → NETC → NAWCTSD). Account views roll up children.
- email domains (list) — used to match contacts and emails to the org
- notes, website

### Contact
- first name, last name, title, organization, emails (one primary, many secondary), phones, LinkedIn, location
- tags, notes, owner
- `last_touch_at` (computed from synced email/meetings)
- `source` (`insightly_import`, `manual`, `gmail_discovered`)
- `status`: active, archived, do-not-contact

### Opportunity
- name, organization (customer), owner, team members
- **engagement type** (required): `direct` (Eduworks sells to the customer), `via client-facing partner`, `white-label license`, `learning engineering services`. Drives which fields show (see Partner Agreement below).
- **partner(s)**: link to organizations with a role on this deal — `client-facing partner`, `white-label licensee`, `learning engineering services` (plus `prime`/`sub` for contract structure). Example: RNZN five-ship deal, StaplesVR = client-facing partner.
  - *Client-facing partner*: partner owns the customer relationship and contract; Eduworks supports. Track who talks to the end customer and Eduworks' share of TCV.
  - *White-label license*: partner sells CADRE under its own brand. The opportunity is with the partner; end customers (if known) are listed as linked orgs. Track license terms on the Partner Agreement.
  - *Learning engineering services*: services-only work (competency analysis, TNA, data onboarding, LE consulting), with or without a CADRE license. TCV is services value; license fields hidden unless a license is attached.
- **stakeholders** (Playbook §5): contact + role — economic buyer, mission/business owner, champion, technical buyer, cybersecurity, procurement, end user, data/system owner, potential blocker. A contact can hold several roles.
- **stage** (one of the 12 below) + **status**: `open`, `on hold` (with reason, e.g., "awaiting funding," "CR," "awaiting ATO"), `won`, `lost`, `no-bid` (lost/no-bid require a reason)
- **deployment branch** (Playbook §3.5): A = self-service SaaS, B = sales-supported SaaS, C = SLED/Federal customer environment. For C, sub-type: customer cloud, gov cloud, on-prem, hybrid, restricted/disconnected; impact level (IL2/IL4/IL5/IL6/other) and ATO status.
- **procurement vehicle**: SBIR Phase III, OTA, competitive RFP, sole source, GSA/schedule, existing contract mod, via prime/partner, commercial PO, other. Link to a Contract Vehicle record when one exists.
- **funding**: source/program, color of money (O&M, RDT&E, Procurement, other, unknown), FY of funds, status (unidentified, identified, programmed, appropriated, obligated)
- **Total Contract Value (TCV)** — always present, may be an estimate; flag `estimate | quoted | contracted`
- **award window** — quarter + FY (e.g., "Q3 FY27"). Only editable when the scorecard rates **Funding** and **Procurement path** green (see §6). Otherwise shown as "untimed."
- problem statement block (Playbook §1.3): Problem → Impact → Desired State → Solution
- **success criteria** list (captured during Discover, evaluated at Demonstrate Outcomes)
- solution design block (Playbook §3.4): CADRE capabilities, services, data, integrations, competency/training consulting, implementation approach. Each requirement tagged `configuration | customization | core product candidate` (Product owns this tag).
- scope block (Playbook §3.8): software, users, data, integrations, services, infrastructure, implementation, support, license count
- Drive folder link (auto-created, see §7)
- next action (text + due date + assignee) — required on every open opportunity

### Partner Agreement
- partner org, relationship type (`client-facing partner`, `white-label licensee`, `learning engineering services`), status (prospect, negotiating, active, expired), start/end dates, linked Drive doc (teaming agreement, NDA, license agreement)
- white-label fields: licensed brand name, territory/market, pricing model (per-seat, per-deployment, royalty %, flat fee), minimum commitments, end customers sublicensed
- services fields: labor categories or rate card link, ceiling
- An organization can hold several agreements (e.g., client-facing partner on one deal, white-label licensee on another). Organization page shows all agreements and all deals the partner touches.

### Contract Vehicle
- name, type, agency, number, ceiling, period of performance, notes. Reusable across opportunities.

### Activity
- type: email, meeting, call, note, demo, proposal submitted, RFI/RFP response, conference touch
- timestamp, participants (contacts + users), linked opportunity/organization
- for synced items: Gmail thread ID or Calendar event ID, subject, snippet, link back to Gmail/Calendar. **Do not store full email bodies** — store metadata, a short snippet, and the deep link.

### Task
- title, due date, assignee, linked opportunity/contact, done flag. The opportunity "next action" is a task flagged as primary.

### License / Subscription (post-sale)
- customer org, linked won opportunity, license count, deployment branch, term start/end, renewal date, value, status (active, renewing, lapsed)
- `via partner` link when sold through a client-facing partner or white-label licensee
- expansion opportunities link back to the license record

### Audit log
- every stage change, scorecard change, and TCV change: who, when, old → new, comment.

## 5. Pipeline stages and gates

Stages follow the playbook's motion. An opportunity advances only when the exit criteria for its current stage are met. Gates are **checklists with required fields**, enforced in the UI and API. Admins may override a gate with a required comment (logged).

| # | Stage | Exit criteria to advance |
|---|---|---|
| 1 | Identify Problem | Problem statement filled (Problem + Impact at minimum); customer org set; at least one contact |
| 2 | Discover | Problem → Impact → Desired State filled; ≥1 success criterion; discovery notes doc linked; ≥1 discovery meeting logged |
| 3 | Qualify | All 8 scorecard criteria rated (none "unknown"); go/no-go decision recorded with rationale |
| 4 | Design Solution | Solution design block filled; each requirement tagged configuration/customization/core |
| 5 | Select Deployment | Branch A/B/C set; for C: environment sub-type, IL, ATO status |
| 6 | Demonstrate | Problem-focused demo logged (activity type `demo`) tied to the problem statement |
| 7 | Validate Value | Validation type chosen (demo only / guided evaluation / proof of value / pilot) and outcome recorded |
| 8 | Scope | Scope block complete incl. license count; TCV marked `quoted` |
| 9 | Contract | Sub-status tracked: pricing → proposal → procurement → negotiation → security/legal review → award. Exit = award/signature; TCV marked `contracted`; status → won |
| 10 | Implement | Handoff checklist done (delivery owner assigned, kickoff logged); License record created |
| 11 | Demonstrate Outcomes | Each success criterion marked met / partially / not met with evidence |
| 12 | Expand & Renew | Ongoing; renewal date tracked on License record |

- Moving backward is always allowed (playbook: "return to discovery"), logged with a reason.
- Stages and gate criteria must be stored as config (seeded from this table), not hard-coded, so we can tune them without a code change.

## 6. Qualification scorecard (replaces P-win)

Eight criteria from Playbook §3.3, each rated **green / yellow / red / unknown** with a one-line justification and last-updated date:

1. Problem severity
2. CADRE fit
3. Champion
4. Decision authority
5. Funding
6. Procurement path
7. Timeline
8. Technical feasibility

Rules:
- Shown as 8 colored dots on every pipeline card and at the top of the opportunity page.
- No single percentage anywhere in the app.
- A rating older than 90 days displays as faded ("stale") to prompt review.
- **Confidence tier** is derived, not entered:
  - *Committed* — stage ≥ 9 and Funding + Procurement path green
  - *Probable* — stage ≥ 6 and ≤ 1 red, Funding not red
  - *Possible* — stage ≥ 3, otherwise
  - *Early* — stage 1–2
  Put the thresholds in config.

## 7. Google Workspace integration

### Gmail (auto-log)
- Per-user sync job every 15 minutes using Gmail history API (incremental), initial backfill of 24 months.
- Match messages to contacts by any email address on From/To/Cc. Unknown external addresses at a known org domain go into a "discovered contacts" review queue (accept / ignore / ignore domain).
- Attach the email activity to the contact, their org, and **the single open opportunity for that org if there is exactly one**; otherwise leave it unlinked and show it in an "assign to opportunity" inbox on the opportunity's org page.
- Users can exclude labels (e.g., `Personal`) and mark threads private (not logged).
- Update `last_touch_at` on contacts and opportunities.

### Google Calendar
- Sync events where any attendee matches a contact. Log as `meeting` activities, same linking rules as Gmail.
- Future meetings with an opportunity's contacts show as "upcoming" on the opportunity.

### Google Drive
- On opportunity creation, create a folder `CADRE Pipeline/<Org> – <Opportunity>` in a configured Shared Drive, with subfolders: `01 Discovery`, `02 Qualification`, `03 Solution & Scope`, `04 Proposal & Contract`, `05 Implementation`.
- Show the folder's recent files on the opportunity page (name, modified, link). Users can also link existing Drive files.

### Google Docs templates
- Admin registers template Google Docs (by file ID) with a type: discovery notes, qualification document, solution design, SOW draft, follow-up summary.
- "Generate" on an opportunity copies the template into the right subfolder and replaces `{{placeholders}}` with record data via the Docs API (org, contacts by stakeholder role, problem statement, success criteria, scorecard table, scope, TCV). Document the placeholder list in the README.
- The generated doc is linked back to the opportunity and, for discovery notes, satisfies the Stage 2 gate.

## 8. Views (v1)

1. **Pipeline board** (home): Kanban by the 12 stages. Card shows org, opportunity name, TCV, branch (A/B/C), 8 scorecard dots, owner avatar, days since last touch, on-hold badge. Filters: owner, branch, market, confidence tier, timed/untimed, status. Summary bar: TCV total by stage and split timed vs. untimed. Drag to move stages; blocked moves show the unmet gate items.
2. **My next actions / stale deals**: my open tasks sorted by due date (overdue first); my opportunities with no email/meeting in > 30 days (configurable); opportunities with stale scorecard ratings; opportunities missing a next action; renewals due in 120 days.
3. Opportunity detail page: header (stage, status, TCV, award window or "untimed", tier, scorecard), tabs for Overview (problem/solution/scope), Stakeholders, Activity timeline, Tasks, Documents, History.
4. Organization page and Contact page: details, hierarchy, related opportunities, activity timeline.
5. Global search across orgs, contacts, opportunities.
6. CSV export of any list view.

Leadership dashboards are out of scope for v1, but design the queries so they're easy to add.

## 9. Contact import (from the cleaned triage workbook)

The Insightly export (3,242 rows; first/last/org/email only) has already been cleaned into `data/import/CADRE_Contacts_Triage.xlsx`. Also included: the raw export and the cleanup script `scripts/clean_contacts.py` (domain map, org alias table, off-target keywords). Reuse that script's maps as seed config files; don't redo the cleanup logic from scratch.

Workbook tabs:
- **Contacts** — 3,116 unique contacts (126 duplicate rows merged by email). Columns: First Name, Last Name, Email, Org (Insightly), Org (Clean), Org Source, Sector, Triage Bucket, Reason, Rows Merged, Email Domain, Reviewer Decision (Keep / Archive / Drop or blank), Reviewer Notes.
- **Organizations** — clean org list with contact counts, sector, domains, plus Parent Org and Org Type columns I fill in.
- **Domains to Map** — domains whose org was only guessed; I fill in Correct Org.

Triage buckets and import behavior:

| Bucket | Count | Import as |
|---|---|---|
| 1 Ready to import | 2,091 | active |
| 2 Confirm sub-org (shared gov domain, org at service level) | 310 | active, tag `confirm sub-org` |
| 3 Identify org (personal email or guessed org) | 505 | active, tag `needs review` |
| 4 Archive candidate (off-target sector) | 144 | archived |
| 5 Fix or drop (no email, junk name, internal) | 66 | skip |

Reviewer Decision, when filled in, overrides the bucket default.

Build:
1. An importer that reads the workbook: applies Domains to Map corrections, then creates orgs (with Parent Org hierarchy and domains), then contacts. Dry-run mode prints counts per bucket, orgs to be created, and conflicts before committing.
2. Idempotent on email: re-running updates, never duplicates.
3. Store org domain lists from the Organizations tab so Gmail sync can match new addresses.
4. A **Review queue** screen listing `confirm sub-org` and `needs review` contacts, filterable by org/domain, with bulk actions: set org, set parent org, archive, keep.
5. After the 24-month Gmail/Calendar backfill, flag contacts with no email or meeting in 3+ years as archive candidates (don't auto-archive), and promote bucket-2/3 contacts that appear in active threads to the top of the review queue.

## 10. Non-functional

- All Google tokens encrypted at rest; least-privilege scopes (`gmail.readonly`, `calendar.readonly`, `drive.file` plus Shared Drive access, `documents`).
- Security posture: no CUI or classified data is expected in this system. Contacts include .mil and foreign-government business contact info only. Add a footer note: "Not for CUI or classified information." No additional compliance (FedRAMP, IL) is required for v1.
- Structured logs; sync job failures visible on an admin status page.
- Seed script with realistic fake data for dev (never real contacts).
- README covering local setup, Google Cloud project/OAuth setup (Internal app), Cloud Run deploy, import steps, and template placeholders.

## 11. Build phases (stop for review after each)

1. **Core**: data model, auth, orgs/contacts/opportunities CRUD, stage gates + scorecard + tier logic (with unit tests), pipeline board, next actions view.
2. **Import**: workbook importer with dry-run report, plus the Review queue screen.
3. **Google sync**: Gmail and Calendar sync, activity timeline, discovered-contacts queue, stale-deal logic.
4. **Drive + Docs**: folder creation, file listing, template generation.
5. **Post-sale**: License records, renewal alerts, expansion opportunities.
6. **Deploy**: Dockerfile, Cloud Run + Cloud SQL config, README.

Before Phase 1, ask me any questions where this spec is ambiguous or where you'd recommend a different approach.
