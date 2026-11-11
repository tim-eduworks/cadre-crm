import Link from "next/link";
import { isStale, ratingOf } from "@/domain/scorecard";
import { CRITERIA, type Scorecard } from "@/domain/types";
import { CRITERION_LABEL, L } from "@/lib/labels";
import { date, dateInput } from "@/lib/format";
import type { FieldDef } from "@/lib/opportunity-fields";

const DOT: Record<string, string> = {
  GREEN: "bg-green-600 border-green-700",
  YELLOW: "bg-yellow-400 border-yellow-500",
  RED: "bg-red-600 border-red-700",
  UNKNOWN: "bg-white border-slate-400 border-dashed",
};

/** The 8 scorecard dots. Stale ratings (older than the configured window) are faded. */
export function Dots({ scorecard, staleDays, size = "sm" }: { scorecard: Scorecard; staleDays: number; size?: "sm" | "lg" }) {
  const cls = size === "lg" ? "h-4 w-4" : "h-2.5 w-2.5";
  return (
    <span className="inline-flex items-center gap-1" role="img" aria-label={CRITERIA.map((c) => `${CRITERION_LABEL[c]}: ${L.rating[ratingOf(scorecard, c)]}`).join(", ")}>
      {CRITERIA.map((c) => {
        const r = ratingOf(scorecard, c);
        const stale = r !== "UNKNOWN" && isStale(scorecard[c]?.updatedAt, staleDays);
        return (
          <span
            key={c}
            data-rating={r}
            data-stale={stale || undefined}
            title={`${CRITERION_LABEL[c]}: ${L.rating[r]}${stale ? ` (stale, last updated ${date(scorecard[c]?.updatedAt)})` : ""}`}
            className={`inline-block rounded-full border ${cls} ${DOT[r]} ${stale ? "opacity-35" : ""}`}
          />
        );
      })}
    </span>
  );
}

const TIER: Record<string, string> = {
  Committed: "border-green-300 bg-green-50 text-green-800",
  Probable: "border-blue-300 bg-blue-50 text-blue-800",
  Possible: "border-amber-300 bg-amber-50 text-amber-800",
  Early: "border-slate-300 bg-slate-100 text-slate-700",
};
export function TierChip({ tier }: { tier: string }) {
  return <span className={`chip ${TIER[tier] ?? ""}`}>{tier}</span>;
}

const STATUS: Record<string, string> = {
  OPEN: "", ON_HOLD: "border-amber-300 bg-amber-50 text-amber-800", WON: "border-green-300 bg-green-50 text-green-800",
  LOST: "border-red-200 bg-red-50 text-red-800", NO_BID: "border-slate-300 bg-slate-200 text-slate-700",
};
export function StatusChip({ status }: { status: string }) {
  return <span className={`chip ${STATUS[status] ?? ""}`}>{L.status[status as keyof typeof L.status] ?? status}</span>;
}

export function ErrorBanner({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm whitespace-pre-line text-red-800">
      {error}
    </div>
  );
}

export function PageHeader({ title, children, sub }: { title: React.ReactNode; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1>{title}</h1>
        {sub && <div className="muted mt-0.5">{sub}</div>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export type Option = { id: string; label: string };

/** Renders one opportunity field from its definition. */
export function FieldInput({ def, value, users = [], orgs = [], vehicles = [] }: {
  def: FieldDef; value: unknown; users?: Option[]; orgs?: Option[]; vehicles?: Option[];
}) {
  const id = `f-${def.name}`;
  const v = value === null || value === undefined ? "" : String(value);
  const select = (opts: Option[]) => (
    <select id={id} name={def.name} defaultValue={v} required={def.required}>
      {!def.required && <option value="">—</option>}
      {opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );
  let input: React.ReactNode;
  switch (def.kind) {
    case "textarea": input = <textarea id={id} name={def.name} defaultValue={v} rows={3} />; break;
    case "enum": input = select(Object.entries(def.options ?? {}).map(([k, l]) => ({ id: k, label: l }))); break;
    case "user": input = select(users); break;
    case "org": input = select(orgs); break;
    case "vehicle": input = select(vehicles); break;
    case "int": input = <input id={id} name={def.name} type="number" min={0} step={1} defaultValue={v} placeholder={def.hint} />; break;
    case "money": input = <input id={id} name={def.name} type="text" inputMode="decimal" defaultValue={v ? Number(v).toFixed(0) : ""} required={def.required} />; break;
    case "date": input = <input id={id} name={def.name} type="date" defaultValue={dateInput(value as Date | null)} />; break;
    default: input = <input id={id} name={def.name} type="text" defaultValue={v} required={def.required} placeholder={def.hint} />;
  }
  return (
    <div>
      <label htmlFor={id}>{def.label}{def.required && <span className="text-red-600"> *</span>}</label>
      {input}
    </div>
  );
}

export function Pager({ page, pageSize, total, hrefFor }: { page: number; pageSize: number; total: number; hrefFor: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
      <span>{total.toLocaleString()} total</span>
      <span className="flex items-center gap-2">
        {page > 1 && <Link className="btn btn-sm" href={hrefFor(page - 1)}>Previous</Link>}
        <span>Page {page} of {pages}</span>
        {page < pages && <Link className="btn btn-sm" href={hrefFor(page + 1)}>Next</Link>}
      </span>
    </div>
  );
}
