import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { date, personName, userName } from "@/lib/format";
import { L } from "@/lib/labels";

export const timelineInclude = {
  participants: { include: { contact: true, user: true } },
  opportunity: { select: { id: true, name: true } },
} satisfies Prisma.ActivityInclude;
type Item = Prisma.ActivityGetPayload<{ include: typeof timelineInclude }>;

export function Timeline({ items }: { items: Item[] }) {
  if (!items.length) return <p className="muted mt-2">No activity yet.</p>;
  return (
    <ol className="mt-2 divide-y divide-slate-200">
      {items.map((a) => (
        <li key={a.id} className="py-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span><span className="chip">{L.activityType[a.type]}</span>{" "}
              {a.link ? <a href={a.link} target="_blank" rel="noreferrer" className="font-medium">{a.subject}</a> : <span className="font-medium">{a.subject}</span>}</span>
            <span className="text-xs text-slate-500">{date(a.occurredAt)}</span>
          </div>
          {a.snippet && <p className="mt-1 text-sm whitespace-pre-line text-slate-700">{a.snippet}</p>}
          <p className="mt-1 text-xs text-slate-500">
            {a.opportunity && <><Link href={`/opportunities/${a.opportunity.id}`}>{a.opportunity.name}</Link> · </>}
            {a.participants.map((p) => (p.contact ? personName(p.contact) : p.user ? userName(p.user) : "")).filter(Boolean).join(", ")}
          </p>
        </li>
      ))}
    </ol>
  );
}
