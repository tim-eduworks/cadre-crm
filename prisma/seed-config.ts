/**
 * Loads config/stages.json and config/tiers.json into the database.
 * Existing rows are left alone (so tuning in the DB survives) unless --force is passed.
 */
import { PrismaClient, Prisma } from "@prisma/client";
import stages from "../config/stages.json";
import tiers from "../config/tiers.json";

export async function seedConfig(db: PrismaClient, force = false) {
  for (const s of stages as { number: number; name: string; gate: unknown; onExit?: unknown }[]) {
    const data = { name: s.name, gate: s.gate as Prisma.InputJsonValue, onExit: (s.onExit as Prisma.InputJsonValue) ?? Prisma.JsonNull };
    await db.stageConfig.upsert({ where: { number: s.number }, create: { number: s.number, ...data }, update: force ? data : {} });
  }
  await db.setting.upsert({ where: { key: "pipeline" }, create: { key: "pipeline", value: tiers }, update: force ? { value: tiers } : {} });
}

if (require.main === module) {
  const db = new PrismaClient();
  seedConfig(db, process.argv.includes("--force"))
    .then(() => console.log("Stage and tier config loaded."))
    .finally(() => db.$disconnect());
}
