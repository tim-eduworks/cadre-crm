import { ContactForm } from "@/components/contact-form";
import { ErrorBanner, PageHeader } from "@/components/ui";
import { orgOptions } from "@/server/queries";
import { requireUser } from "@/server/session";
import { saveContact } from "../../actions";

export default async function NewContact({ searchParams }: { searchParams: Promise<{ error?: string; org?: string }> }) {
  await requireUser();
  const { error, org } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New contact" />
      <ErrorBanner error={error} />
      <div className="card"><ContactForm action={saveContact} orgs={await orgOptions()} defaultOrg={org} /></div>
    </div>
  );
}
