import { cache } from "react";
import stagesJson from "@config/stages.json";
import tiersJson from "@config/tiers.json";
import type { PipelineConfig, StageDef } from "@/domain/types";
import { db } from "./db";

/** Stages + gates from the database (seeded from config/stages.json); falls back to the file if unseeded. */
export const getStages = cache(async (): Promise<StageDef[]> => {
  const rows = await db.stageConfig.findMany({ orderBy: { number: "asc" } });
  if (!rows.length) return stagesJson as StageDef[];
  return rows.map((r) => ({
    number: r.number,
    name: r.name,
    gate: r.gate as unknown as StageDef["gate"],
    onExit: r.onExit as StageDef["onExit"],
  }));
});

export const getPipelineConfig = cache(async (): Promise<PipelineConfig> => {
  const row = await db.setting.findUnique({ where: { key: "pipeline" } });
  return { ...(tiersJson as PipelineConfig), ...((row?.value as object) ?? {}) };
});
