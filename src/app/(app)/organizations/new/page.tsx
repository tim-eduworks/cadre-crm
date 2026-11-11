import { OrgForm } from "@/components/org-form";
import { ErrorBanner, PageHeader } from "@/components/ui";
import { orgOptions } from "@/server/queries";
import { requireUser } from "@/server/session";
import { saveOrganization } from "../../actions";

export default async function NewOrganization({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireUser();
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New organization" />
      <ErrorBanner error={error} />
      <div className="card"><OrgForm action={saveOrganization} orgs={await orgOptions()} /></div>
    </div>
  );
}
