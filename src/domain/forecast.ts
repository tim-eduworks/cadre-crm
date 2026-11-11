export type ForecastRow = { stage: number; tcv: number; timed: boolean; tier: string };

export type ForecastSummary = {
  byStage: Record<number, { count: number; tcv: number; timed: number; untimed: number }>;
  total: number;
  timed: number;
  untimed: number;
  byTier: Record<string, { count: number; tcv: number }>;
};

/** TCV rolled up by stage, split timed vs. untimed, and by confidence tier. No probability weighting. */
export function summarize(rows: ForecastRow[]): ForecastSummary {
  const out: ForecastSummary = { byStage: {}, total: 0, timed: 0, untimed: 0, byTier: {} };
  for (const r of rows) {
    const s = (out.byStage[r.stage] ??= { count: 0, tcv: 0, timed: 0, untimed: 0 });
    s.count += 1;
    s.tcv += r.tcv;
    if (r.timed) { s.timed += r.tcv; out.timed += r.tcv; } else { s.untimed += r.tcv; out.untimed += r.tcv; }
    out.total += r.tcv;
    const t = (out.byTier[r.tier] ??= { count: 0, tcv: 0 });
    t.count += 1;
    t.tcv += r.tcv;
  }
  return out;
}
