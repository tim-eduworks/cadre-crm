"""Clean and triage the Insightly contact export. Usage: python clean_contacts.py in.xlsx out.xlsx"""
import sys, re, collections
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo

src, out = sys.argv[1], sys.argv[2]
rows = list(openpyxl.load_workbook(src, read_only=True).worksheets[0].iter_rows(values_only=True))[1:]

PERSONAL = {"gmail.com","yahoo.com","hotmail.com","aol.com","outlook.com","cox.net","mac.com","icloud.com",
            "me.com","comcast.net","verizon.net","att.net","msn.com","live.com","yahoo.com.sg","protonmail.com",
            "sbcglobal.net","bellsouth.net","earthlink.net","rogers.com","shaw.ca","sympatico.ca","ymail.com",
            "charter.net","googlemail.com","hotmail.ca","yahoo.ca","yahoo.co.uk","btinternet.com","q.com"}
# Shared umbrella domains: org can only be set at service/department level
UMBRELLA = {"mail.mil":"DoD (unspecified)","navy.mil":"U.S. Navy","us.navy.mil":"U.S. Navy",
            "us.af.mil":"U.S. Air Force","af.mil":"U.S. Air Force","usmc.mil":"U.S. Marine Corps",
            "army.mil":"U.S. Army","us.army.mil":"U.S. Army","uscg.mil":"U.S. Coast Guard",
            "forces.gc.ca":"Canadian Armed Forces","ecn.forces.gc.ca":"Royal Canadian Navy",
            "mod.uk":"UK MOD","defence.gov.au":"Australian Department of Defence","osd.mil":"OSD",
            "hq.dhs.gov":"DHS","nasa.gov":"NASA","gnb.ca":"Government of New Brunswick","dodiis.mil":"DIA",
            "spaceforce.mil":"Space Force","gc.ca":"Government of Canada","dhs.gov":"DHS","af.mil":"U.S. Air Force","faa.gov":"FAA","nps.edu":"Naval Postgraduate School"}
MANUAL_DOMAIN = {"icfi.com":"ICF","icf.com":"ICF","bgi-llc.com":"BGI LLC","hii-nns.com":"Huntington Ingalls Industries",
    "raytheon.com":"Raytheon","clarionevents.com":"Clarion Events","extension.org":"Extension Foundation",
    "deloitte.co.uk":"Deloitte UK","adlnet.gov":"ADL Initiative","odu.edu":"Old Dominion University",
    "tier1performance.com":"Tier 1 Performance","erau.edu":"Embry-Riddle Aeronautical University",
    "eduworks.com":"Eduworks","ist.ucf.edu":"UCF Institute for Simulation and Training","ctc.com":"Concurrent Technologies Corporation",
    "mymic.net":"Mymic","cesicorp.com":"CESI","ict.usc.edu":"USC Institute for Creative Technologies","ihmc.us":"IHMC",
    "sri.com":"SRI International","macb.com":"MacAulay-Brown","tno.nl":"TNO","memphis.edu":"University of Memphis",
    "act.nato.int":"NATO ACT","gdit.com":"GDIT","cape-henry.com":"Cape Henry Associates","idsi.com":"IDSI",
    "consensys.net":"ConsenSys","mak.com":"MAK Technologies","ngc.com":"Northrop Grumman","mitre.org":"MITRE",
    "i-a-i.com":"Intelligent Automation Inc.","sseinc.com":"SSE Inc.","camber.com":"Camber","kovaglobal.com":"KOVA Global",
    "cubic.com":"Cubic","halldale.com":"Halldale","discoverymachine.com":"Discovery Machine","usmcu.edu":"Marine Corps University",
    "gtri.gatech.edu":"Georgia Tech Research Institute","drexel.edu":"Drexel University","unl.edu":"University of Nebraska-Lincoln",
    "jhuapl.edu":"Johns Hopkins APL","ndia.org":"NDIA","stottlerhenke.com":"Stottler Henke","kongsberg.com":"Kongsberg",
    "problemsolutions.net":"Problem Solutions","darpa.mil":"DARPA","usma.edu":"U.S. Military Academy","opm.gov":"OPM",
    "alelo.com":"Alelo","cra.com":"Charles River Analytics","designinteractive.net":"Design Interactive",
    "modusoperandi.com":"Modus Operandi","threattec.com":"Threat Tec","ausa.org":"AUSA","uschamber.com":"U.S. Chamber of Commerce",
    "mail.arc.nasa.gov":"NASA Ames","tma.osd.mil":"TRICARE Management Activity","drdc-rddc.gc.ca":"DRDC",
    "caemilusa.com":"CAE","cae.com":"CAE","bah.com":"Booz Allen Hamilton","lmco.com":"Lockheed Martin",
    "saic.com":"SAIC","boeing.com":"Boeing","baesystems.com":"BAE Systems","aptima.com":"Aptima","accenture.com":"Accenture",
    "soartech.com":"SoarTech","link.com":"Link Simulation & Training","simigon.com":"SIMIGON","agustawestland.com":"AgustaWestland",
    "inzpire.com":"Inzpire","upenn.edu":"University of Pennsylvania","cmu.edu":"Carnegie Mellon University","usc.edu":"University of Southern California","uga.edu":"University of Georgia","slu.edu":"Saint Louis University","wmich.edu":"Western Michigan University","uoguelph.ca":"University of Guelph","iastate.edu":"Iowa State University","delval.edu":"Delaware Valley University","adobe.com":"Adobe","foxrothschild.com":"Fox Rothschild","enterprise-knowledge.com":"Enterprise Knowledge","osigeospatial.com":"OSI Geospatial","gibbscox.com":"Gibbs & Cox","goldbelt.com":"Goldbelt","cerego.com":"Cerego","energid.com":"Energid","idb.org":"IDB (Inter-American Development)","esg.de":"ESG","ifad.dk":"IFAD","sra.com":"SRA International"}
ALIAS = {"bah":"Booz Allen Hamilton","booz allen hamilton inc.":"Booz Allen Hamilton","lmco":"Lockheed Martin",
    "baesystems":"BAE Systems","homeland seecurity":"DHS","homeland security":"DHS","spaceforce":"Space Force",
    "northrop":"Northrop Grumman","mitre":"MITRE","mitre corporation":"MITRE","par tech":"PAR Government Systems",
    "partech":"PAR Government Systems","par":"PAR Government Systems","par government systems corporation":"PAR Government Systems",
    "raytheon company":"Raytheon","naval air warfare center training systems division":"NAWCTSD",
    "janus research group":"Janus Research","bisimulations":"Bohemia Interactive Simulations","bohemia interactive":"Bohemia Interactive Simulations",
    "eduworks corporation":"Eduworks","microsoft corporation":"Microsoft","national security agency":"NSA",
    "defense acquisition university":"DAU","sparkgrowth":"Spark Growth LLC","valkyrie":"Valkyrie Enterprises",
    "realitydefender":"Reality Defender","deepmedia":"DEEP MEDIA","d2teamsim":"D2 TEAM-Sim",
    "linchpin solutions incorporated":"Linchpin Solutions","powertrain inc":"PowerTrain","naviworks co ltd.":"Naviworks Co.,Ltd.",
    "engineering  & computer simulations(ecs)":"Engineering & Computer Simulations (ECS)","usafe afafrica warfare cent":"USAFE-AFAFRICA Warfare Center",
    "usafe-afafrica warfare center":"USAFE-AFAFRICA Warfare Center","defense language institute elc":"DLI English Language Center",
    "defense language institute english language center":"DLI English Language Center","carleycorp":"Carley Corporation",
    "plexsys":"PLEXSYS Interface Products, Inc.","aerosimulation":"Aero Simulation, Inc.","proactivetechllc":"ProActive Technologies",
    "scopear":"Scope AR","aptima, inc.":"Aptima","vmasc old dominion university":"VMASC","odu":"Old Dominion University",
    "huntington ingalls industries":"Huntington Ingalls Industries","hii":"Huntington Ingalls Industries","icf international":"ICF",
    "mitek systems":"Mitek Systems","united states navy":"U.S. Navy","army":"U.S. Army","dod":"Department of Defense",
    "department of defense":"Department of Defense","national science foundation":"NSF","ucf":"University of Central Florida",
    "nato school":"NATO School","bluedrop usa":"Bluedrop","australian dod":"Australian Department of Defence",
    "department of defence":"Australian Department of Defence","uk mod":"UK MOD","ministry of defence":"UK MOD",
    "amazon web services":"AWS","second air force":"2AF","baesystems.com":"BAE Systems","dla":"DLA",
    "mail":None,"systems":None,"vp bd":None,"gsd":None,"str":"Systems and Technology Research, LLC"}
OFF_TARGET = re.compile(r"\b(bank|bancorp|financial|finra|capital|credit|insurance|indemnity|blue cross|chubb|aegon|"
    r"kennels|cafe|tennis|coldwell|ticketmaster|walmart|mattel|forensic|zscaler|crowdstrike|fortinet|palo alto|sophos|"
    r"trend micro|checkpoint|cato networks|lastpass|orca security|cellebrite|pindrop|biocatch|signifyd|zero ?fox|"
    r"recorded future|rapid ?7|reliaquest|cyfirma|cloudsek|ctm360|soc radar|seon|fraud\.net|perception point|bufferzone|"
    r"cyolo|pkware|irdeto|vormetric|forcepoint|versa networks|juniper|harmonic security|safe security|elastic|eltropy|"
    r"alogent|visa|gm financial|axos|pathward|marsh mclennan|clubmakers|voice actors|girl guides|cruising|fire & rescue|"
    r"friendship centre|macroni|kingston|toronto|edmonton|axcelerate|webz|kela|sumuri|teel technologies|oxygen|berla|"
    r"monolith|primeau|blackstone forensics|garrett discovery|hankey|h i g capital|apple bank)\b", re.I)

def norm_key(s):
    s = s.lower().strip()
    s = re.sub(r"[.,]", "", s)
    s = re.sub(r"\b(inc|llc|ltd|corp|corporation|company|co)\b", "", s)
    return re.sub(r"\s+", " ", s).strip()

def canon(org):
    if not org: return None
    o = re.sub(r"\s+", " ", str(org)).strip()
    if not o: return None
    if o.lower() in ALIAS: return ALIAS[o.lower()]
    return o

def sector(domain, org):
    d = domain or ""
    if d.endswith(".mil"): return "U.S. DoD"
    if d.endswith(".gov") or d.endswith(".fed.us"): return "U.S. Federal civilian"
    if re.search(r"(\.gc\.ca|gnb\.ca|\.gov\.[a-z]{2}|\.gv\.at|mod\.uk|nato\.int|defence\.gov\.au|\.mil\.[a-z]{2}|forsvaret|fmv\.se|mindef)", d):
        return "Foreign / allied government"
    if d.endswith(".edu") or ".ac." in d or re.search(r"(university|college|\.edu\.)", d + " " + (org or ""), re.I):
        return "Academic"
    if d in PERSONAL or not d: return "Unknown"
    return "Commercial / industry"

# Pass 1: build canonical org names (merge casing/punctuation variants) and learn company domains
raw = []
for r in rows:
    fn, ln, org, em = [(str(x).strip() if x is not None else "") for x in (r + (None,)*4)[:4]]
    raw.append([fn, ln, org, em.lower()])
variant = collections.defaultdict(collections.Counter)
for fn, ln, org, em in raw:
    c = canon(org)
    if c: variant[norm_key(c)][c] += 1
display = {k: v.most_common(1)[0][0] for k, v in variant.items()}
def canon2(org):
    c = canon(org)
    return display.get(norm_key(c), c) if c else None

learned = collections.defaultdict(collections.Counter)
for fn, ln, org, em in raw:
    c = canon2(org)
    if c and "@" in em:
        d = em.split("@")[-1]
        if d not in PERSONAL and d not in UMBRELLA: learned[d][c] += 1

def lookup(m, d):
    """Exact match, else nearest parent domain (e.g., x.dhs.gov -> dhs.gov)."""
    parts = d.split(".")
    for i in range(len(parts) - 1):
        k = ".".join(parts[i:])
        if k in m and (i == 0 or k.count(".") >= 1): return m[k]
    return None

# Pass 2: dedupe by email
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[a-z]{2,}$")
groups = collections.OrderedDict(); noemail = []
for rec in raw:
    if rec[3]: groups.setdefault(rec[3], []).append(rec)
    else: noemail.append(rec)
def score(rec): return (bool(rec[2]), len(rec[0]) > 1, bool(rec[1]))
out_rows = []
for em, recs in groups.items():
    best = max(recs, key=score)
    orgs_seen = sorted({canon2(r[2]) for r in recs if canon2(r[2])})
    out_rows.append((best, len(recs), orgs_seen))
for rec in noemail: out_rows.append((rec, 1, [canon2(rec[2])] if canon2(rec[2]) else []))

final = []
for (fn, ln, org, em), n, orgs_seen in out_rows:
    junk_name = (not re.search(r"[A-Za-z]{2}", fn + ln))
    d = em.split("@")[-1] if "@" in em else ""
    valid = bool(EMAIL_RE.match(em))
    c = canon2(org); src_ = "Insightly"
    if not c:
        if lookup(UMBRELLA, d): c, src_ = lookup(UMBRELLA, d), "Umbrella domain"
        elif lookup(MANUAL_DOMAIN, d): c, src_ = lookup(MANUAL_DOMAIN, d), "Domain map"
        elif lookup(learned, d): c, src_ = lookup(learned, d).most_common(1)[0][0], "Learned from other contacts"
        elif d and d not in PERSONAL:
            root = d.split(".")[-3] if re.search(r"\.(co|com|ac|gov|org)\.[a-z]{2}$", d) else d.split(".")[-2]
            c, src_ = root.replace("-", " ").title(), "Domain guess"
        else: src_ = "None"
    elif d in UMBRELLA: src_ = "Insightly"
    sec = sector(d, c)
    # Triage
    if not em or not valid: b, why = "5 Fix or drop", "No valid email"
    elif junk_name: b, why = "5 Fix or drop", "No usable name"
    elif d == "eduworks.com" or (c or "").lower() == "eduworks": b, why = "5 Fix or drop", "Internal Eduworks contact"
    elif c and OFF_TARGET.search(c): b, why = "4 Archive candidate", "Off-target sector (banking/cyber/retail/other)"
    elif src_ in ("Insightly", "Domain map", "Learned from other contacts") and not (d in UMBRELLA and src_ != "Insightly"):
        b, why = "1 Ready to import", "Org known" if src_ == "Insightly" else f"Org inferred: {src_.lower()}"
    elif src_ == "Umbrella domain": b, why = "2 Confirm sub-org", f"Shared domain {d}; set command/office"
    else: b, why = "3 Identify org", "Personal email" if d in PERSONAL else "Org guessed from domain"
    if len(orgs_seen) > 1: why += f"; merged dupes listed orgs: {', '.join(orgs_seen)}"
    final.append([fn if not junk_name else "", ln, em, org, c or "", src_, sec, b, why, n, d])
final.sort(key=lambda r: (r[7], (r[4] or "zzz").lower(), r[1].lower()))

# Build workbook
wb = openpyxl.Workbook()
F = "Arial"; hdr_fill = PatternFill("solid", fgColor="1F3864"); hdr_font = Font(name=F, bold=True, color="FFFFFF")
def style_header(ws, ncol):
    for c in range(1, ncol + 1):
        cell = ws.cell(row=1, column=c); cell.font = hdr_font; cell.fill = hdr_fill
        cell.alignment = Alignment(vertical="center", wrap_text=True)
    ws.freeze_panes = "A2"
def widths(ws, ws_w):
    for i, w in enumerate(ws_w, 1): ws.column_dimensions[get_column_letter(i)].width = w
def fontall(ws):
    for row in ws.iter_rows(min_row=2):
        for c in row: c.font = Font(name=F, bold=c.font.bold if c.font else False)

summ = wb.active; summ.title = "Triage Plan"
ct = wb.create_sheet("Contacts")
H = ["First Name","Last Name","Email","Org (Insightly)","Org (Clean)","Org Source","Sector","Triage Bucket","Reason","Rows Merged","Email Domain","Reviewer Decision","Reviewer Notes"]
ct.append(H)
for r in final: ct.append(r + ["", ""])
style_header(ct, len(H)); widths(ct, [14,16,34,26,30,22,22,20,48,10,22,18,30]); fontall(ct)
for row in ct.iter_rows(min_row=2, min_col=12, max_col=13):
    for c in row: c.fill = PatternFill("solid", fgColor="FFF2CC")
tab = Table(displayName="Contacts", ref=f"A1:{get_column_letter(len(H))}{ct.max_row}")
tab.tableStyleInfo = TableStyleInfo(name="TableStyleLight9", showRowStripes=True); ct.add_table(tab)

# Organizations sheet
og = wb.create_sheet("Organizations")
oc = collections.defaultdict(lambda: {"n":0, "sec":collections.Counter(), "dom":collections.Counter()})
for r in final:
    if r[4] and r[7] != "5 Fix or drop":
        oc[r[4]]["n"] += 1; oc[r[4]]["sec"][r[6]] += 1
        if r[10]: oc[r[4]]["dom"][r[10]] += 1
og.append(["Organization","Contacts","Sector","Email Domains","Off-target?","Parent Org (fill in)","Org Type (fill in)"])
for name, v in sorted(oc.items(), key=lambda kv: -kv[1]["n"]):
    og.append([name, v["n"], v["sec"].most_common(1)[0][0], ", ".join(d for d, _ in v["dom"].most_common(4)),
               "Yes" if OFF_TARGET.search(name) else "", "", ""])
style_header(og, 7); widths(og, [40,10,24,40,11,26,22]); fontall(og)
for row in og.iter_rows(min_row=2, min_col=6, max_col=7):
    for c in row: c.fill = PatternFill("solid", fgColor="FFF2CC")

# Domain review sheet: domains whose org was guessed
dm = wb.create_sheet("Domains to Map")
gc = collections.Counter(r[10] for r in final if r[5] == "Domain guess")
dm.append(["Email Domain","Contacts","Guessed Org","Correct Org (fill in)"])
guess = {r[10]: r[4] for r in final if r[5] == "Domain guess"}
for d, n in gc.most_common(): dm.append([d, n, guess[d], ""])
style_header(dm, 4); widths(dm, [30,10,30,34]); fontall(dm)
for row in dm.iter_rows(min_row=2, min_col=4, max_col=4):
    for c in row: c.fill = PatternFill("solid", fgColor="FFF2CC")

# Triage plan sheet (live counts via formulas)
n_raw = len(raw); n_dupe_rows = sum(n - 1 for _, n, _ in out_rows)
s = summ
s["A1"] = "Insightly Contact Cleanup & Triage Plan"; s["A1"].font = Font(name=F, bold=True, size=14)
s["A2"] = f"Source: Insightly export 2026-10-15, {n_raw:,} rows. {n_dupe_rows} duplicate rows merged by email."
s["A2"].font = Font(name=F, italic=True)
s.append([])
s.append(["Bucket","Contacts","What it means","Action","Owner"])
plan = [
 ("1 Ready to import","Valid email; org from Insightly or a confident domain match","Import as active. Gmail sync will confirm who is current.","CRM import"),
 ("2 Confirm sub-org","Shared gov domain (mail.mil, navy.mil, us.af.mil, forces.gc.ca...). Org set at service level only","Import now at service level; set command/office (e.g., NAWCTSD, AETC, PEO STRI) when known. Prioritize anyone tied to an open CADRE deal.","BD, batch review"),
 ("3 Identify org","Personal email (gmail etc.) or org guessed from an unfamiliar domain","Fix the 'Domains to Map' tab first (fixes many rows at once). Then review personal-email contacts; archive anyone you don't recognize.","BD, 1 session"),
 ("4 Archive candidate","Org is outside CADRE markets (banks, cyber vendors, retail, local orgs)","Import as archived (kept, hidden from lists). Spot-check before bulk-archiving.","BD, spot-check"),
 ("5 Fix or drop","No valid email, no usable name, or internal Eduworks","Drop unless you recognize the person.","BD, quick pass"),
]
for i, (b, m, a, o) in enumerate(plan):
    r = 5 + i
    s.cell(row=r, column=1, value=b); s.cell(row=r, column=2, value=f'=COUNTIF(Contacts!H:H,A{r})')
    s.cell(row=r, column=3, value=m); s.cell(row=r, column=4, value=a); s.cell(row=r, column=5, value=o)
s.cell(row=10, column=1, value="Total unique contacts"); s.cell(row=10, column=2, value="=SUM(B5:B9)")
s.cell(row=10, column=1).font = Font(name=F, bold=True); s.cell(row=10, column=2).font = Font(name=F, bold=True)
style_r = 4
for c in range(1, 6):
    cell = s.cell(row=style_r, column=c); cell.font = hdr_font; cell.fill = hdr_fill
s["A12"] = "Sequence"; s["A12"].font = Font(name=F, bold=True)
steps = [
 "1. Map domains: fill 'Correct Org' on the Domains to Map tab (top 30 domains cover most of bucket 3).",
 "2. Set parent orgs on the Organizations tab for gov commands (e.g., NAWCTSD → U.S. Navy) so account views roll up.",
 "3. Mark Reviewer Decision (Keep / Archive / Drop) on Contacts for buckets 3–5; leave blank to accept the default.",
 "4. Import into the new CRM: bucket 1–3 active, bucket 4 archived, bucket 5 dropped unless marked Keep.",
 "5. After 24-month Gmail/Calendar backfill: flag contacts with no email or meeting in 3+ years as archive candidates.",
 "6. Re-review bucket 2 contacts as they show up in email threads; set their command then.",
]
for i, t in enumerate(steps): s.cell(row=13 + i, column=1, value=t)
s["A20"] = "Yellow columns on other tabs are for your input. Bucket rules are heuristics; sector and off-target flags come from email domain and org-name keywords."
s["A20"].font = Font(name=F, italic=True, color="7F7F7F")
for row in s.iter_rows(min_row=4, max_row=20):
    for c in row:
        if c.row != 4: c.font = Font(name=F, bold=c.font.bold, italic=c.font.italic, color=c.font.color)
        c.alignment = Alignment(wrap_text=True, vertical="top")
widths(s, [24,11,52,62,16])

# Sector breakdown
s["G4"] = "Sector"; s["H4"] = "Contacts"
for c in ("G4","H4"): s[c].font = hdr_font; s[c].fill = hdr_fill
for i, sec_ in enumerate(["U.S. DoD","U.S. Federal civilian","Foreign / allied government","Commercial / industry","Academic","Unknown"]):
    s.cell(row=5+i, column=7, value=sec_).font = Font(name=F)
    s.cell(row=5+i, column=8, value=f'=COUNTIFS(Contacts!G:G,G{5+i},Contacts!H:H,"<>5 Fix or drop")').font = Font(name=F)
s.column_dimensions["G"].width = 28; s.column_dimensions["H"].width = 11
wb.save(out)
print("rows", n_raw, "unique", len(final), "merged", n_dupe_rows)
print(collections.Counter(r[7] for r in final)); print(collections.Counter(r[6] for r in final if r[7][0] != "5"))
print(collections.Counter(r[5] for r in final))
