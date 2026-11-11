import { notFound } from "next/navigation";
import { ErrorBanner, PageHeader } from "@/components/ui";
import { date } from "@/lib/format";
import { L } from "@/lib/labels";
import { db } from "@/server/db";
import { requireUser } from "@/server/session";
import { saveUser } from "../../actions";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const me = await requireUser();
  if (me.role !== "ADMIN") notFound();
  const { error } = await searchParams;
  const users = await db.user.findMany({ orderBy: { email: "asc" } });
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Users" sub="People appear here after their first Google sign-in. Templates, settings, imports and sync status are added in later phases." />
      <ErrorBanner error={error} />
      <div className="card">
        <table className="table">
          <thead><tr><th>User</th><th>Joined</th><th>Role &amp; access</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><span className="font-medium">{u.name ?? u.email}</span><div className="text-xs text-slate-500">{u.email}</div></td>
                <td>{date(u.createdAt)}</td>
                <td>
                  <form action={saveUser} className="flex items-center gap-3">
                    <input type="hidden" name="userId" value={u.id} />
                    <select name="role" aria-label={`Role for ${u.email}`} defaultValue={u.role} className="!mt-0 !w-32">
                      {Object.entries(L.role).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                    <label className="flex items-center gap-1.5 !text-sm"><input type="checkbox" name="active" value="1" defaultChecked={u.active} /> Active</label>
                    <button className="btn btn-sm">Save</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
