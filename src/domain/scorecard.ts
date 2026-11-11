import { CRITERIA, type Criterion, type PipelineConfig, type Rating, type Scorecard } from "./types";

const DAY = 86_400_000;

export function ratingOf(sc: Scorecard, c: Criterion): Rating {
  return sc[c]?.rating ?? "UNKNOWN";
}

/** A rating is stale when it was last reviewed more than `staleDays` ago. Unknown ratings are never "stale". */
export function isStale(updatedAt: Date | string | null | undefined, staleDays: number, now = new Date()): boolean {
  if (!updatedAt) return false;
  return now.getTime() - new Date(updatedAt).getTime() > staleDays * DAY;
}

export function staleCriteria(sc: Scorecard, staleDays: number, now = new Date()): Criterion[] {
  return CRITERIA.filter((c) => ratingOf(sc, c) !== "UNKNOWN" && isStale(sc[c]?.updatedAt, staleDays, now));
}

/** Confidence tier: derived from stage + scorecard, first matching rule wins. Never a percentage. */
export function confidenceTier(stage: number, sc: Scorecard, cfg: Pick<PipelineConfig, "tiers">): string {
  const reds = CRITERIA.filter((c) => ratingOf(sc, c) === "RED").length;
  for (const t of cfg.tiers) {
    if (stage < t.minStage) continue;
    if (t.requireGreen && !t.requireGreen.every((c) => ratingOf(sc, c) === "GREEN")) continue;
    if (t.maxRed !== undefined && reds > t.maxRed) continue;
    if (t.notRed && t.notRed.some((c) => ratingOf(sc, c) === "RED")) continue;
    return t.name;
  }
  return cfg.tiers[cfg.tiers.length - 1]?.name ?? "Early";
}

/** The award window may only be set/shown while the configured criteria (Funding + Procurement path) are green. */
export function awardWindowUnlocked(sc: Scorecard, cfg: Pick<PipelineConfig, "awardWindowRequiresGreen">): boolean {
  return cfg.awardWindowRequiresGreen.every((c) => ratingOf(sc, c) === "GREEN");
}

export type AwardWindow = { quarter: number; fy: number };

/**
 * Effective award window. A stored window is kept but hidden ("untimed") whenever the scorecard
 * no longer unlocks it; it reappears when the criteria go green again.
 */
export function effectiveAwardWindow(
  stored: { awardQuarter: number | null; awardFy: number | null },
  sc: Scorecard,
  cfg: Pick<PipelineConfig, "awardWindowRequiresGreen">,
): AwardWindow | null {
  if (!stored.awardQuarter || !stored.awardFy) return null;
  if (!awardWindowUnlocked(sc, cfg)) return null;
  return { quarter: stored.awardQuarter, fy: stored.awardFy };
}

export function formatAwardWindow(w: AwardWindow | null): string {
  return w ? `Q${w.quarter} FY${String(w.fy).slice(-2)}` : "Untimed";
}

/** US federal fiscal quarter for a date (FY starts in `startMonth`, default October). */
export function fiscalQuarter(d: Date, startMonth = 10): AwardWindow {
  const m = d.getUTCMonth() + 1;
  const offset = (m - startMonth + 12) % 12;
  const fy = m >= startMonth && startMonth !== 1 ? d.getUTCFullYear() + 1 : d.getUTCFullYear();
  return { quarter: Math.floor(offset / 3) + 1, fy };
}
