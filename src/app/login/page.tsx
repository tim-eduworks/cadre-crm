import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { ALLOWED_DOMAIN, DEV_LOGIN, signIn } from "@/auth";
import { currentUser } from "@/server/session";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentUser()) redirect("/");
  const { error } = await searchParams;

  async function google() {
    "use server";
    await signIn("google", { redirectTo: "/" });
  }
  async function dev(fd: FormData) {
    "use server";
    try {
      await signIn("dev", { email: String(fd.get("email") ?? ""), redirectTo: "/" });
    } catch (e) {
      if (e instanceof AuthError) redirect("/login?error=AccessDenied");
      throw e;
    }
  }

  return (
    <main className="mx-auto mt-24 max-w-sm px-4">
      <div className="card space-y-4">
        <div>
          <h1>CADRE Pipeline</h1>
          <p className="muted mt-1">Sign in with your {ALLOWED_DOMAIN} Google account.</p>
        </div>
        {error && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">
            Sign-in failed. Only {ALLOWED_DOMAIN} Workspace accounts can use this app.
          </p>
        )}
        <form action={google}>
          <button className="btn btn-primary w-full">Sign in with Google</button>
        </form>
        {DEV_LOGIN && (
          <form action={dev} className="space-y-2 border-t border-slate-200 pt-4">
            <label htmlFor="email">Dev login (local only)</label>
            <input id="email" name="email" type="email" required defaultValue={`dev.admin@${ALLOWED_DOMAIN}`} />
            <button className="btn w-full">Dev sign in</button>
          </form>
        )}
      </div>
    </main>
  );
}
