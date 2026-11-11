import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { moveStage } from "@/server/opportunities";
import { AppError, currentUser } from "@/server/session";

const Body = z.object({ target: z.number().int(), comment: z.string().max(2000).optional(), override: z.boolean().optional() });

/** Move an opportunity to another stage. 409 + `unmet` when a gate blocks the move. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { id } = await params;
  try {
    const opp = await moveStage(user, id, parsed.data.target, parsed.data);
    revalidatePath("/");
    return NextResponse.json({ id: opp.id, stage: opp.stage, status: opp.status });
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ error: e.message, ...(e.details as object) }, { status: e.status });
    throw e;
  }
}
