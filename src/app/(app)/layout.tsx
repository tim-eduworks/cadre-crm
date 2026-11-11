import Link from "next/link";
import { signOut } from "@/auth";
import { userName } from "@/lib/format";
import { requireUser } from "@/server/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }
  const nav = [
    ["/", "Pipeline"], ["/next-actions", "Next actions"], ["/organizations", "Organizations"], ["/contacts", "Contacts"], ["/vehicles", "Vehicles"],
    ...(user.role === "ADMIN" ? [["/admin/users", "Admin"]] : []),
  ];
  return (
    <>
      <header className="border-b border-brand-900 bg-brand-700 text-white">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2">
          <Link href="/" className="text-base font-semibold text-white hover:no-underline">CADRE Pipeline</Link>
          <nav aria-label="Main" className="flex flex-wrap gap-4 text-sm">
            {nav.map(([href, text]) => <Link key={href} href={href} className="text-white/90 hover:text-white">{text}</Link>)}
          </nav>
          <form action="/search" className="ml-auto flex items-center gap-2" role="search">
            <input type="search" name="q" aria-label="Search organizations, contacts and opportunities" placeholder="Search…" className="!mt-0 w-56 !border-brand-900 text-slate-900" />
          </form>
          <span className="text-sm text-white/90">{userName(user)}</span>
          <form action={logout}><button className="cursor-pointer text-sm text-white/80 underline hover:text-white">Sign out</button></form>
        </div>
      </header>
      <main className="px-4 py-4">{children}</main>
    </>
  );
}
