import { redirect } from "next/navigation";
import { cache } from "react";
import type { User } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "./db";

export class AppError extends Error {
  constructor(message: string, public status = 400, public details?: unknown) {
    super(message);
  }
}

/** Current user from the database (role and active flag are always fresh), or null. */
export const currentUser = cache(async (): Promise<User | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await db.user.findUnique({ where: { id } });
  return user?.active ? user : null;
});

/** For pages and server actions: redirects to /login when signed out. */
export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new AppError("Admins only", 403);
  return user;
}
