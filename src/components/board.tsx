"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export type BoardCard = {
  id: string;
  name: string;
  org: string | null;
  stage: number;
  status: string;
  holdReason: string | null;
  tcv: string;
  tcvFlag: string;
  branch: string | null;
  tier: string;
  awardWindow: string;
  owner: string;
  ownerInitials: string;
  touchDays: number | null;
  dots: { label: string; rating: string; stale: boolean }[];
};
export type BoardColumn = { number: number; name: string; total: string; timed: string; untimed: string; cards: BoardCard[] };

type Unmet = { stage: number; name: string; items: string[] };
type Pending =
  | { kind: "blocked"; card: BoardCard; target: number; unmet: Unmet[] }
  | { kind: "backward"; card: BoardCard; target: number }
  | null;

const DOT: Record<string, string> = {
  GREEN: "bg-green-600 border-green-700",
  YELLOW: "bg-yellow-400 border-yellow-500",
  RED: "bg-red-600 border-red-700",
  UNKNOWN: "bg-white border-slate-400 border-dashed",
};
const TIER: Record<string, string> = {
  Committed: "border-green-300 bg-green-50 text-green-800",
  Probable: "border-blue-300 bg-blue-50 text-blue-800",
  Possible: "border-amber-300 bg-amber-50 text-amber-800",
  Early: "border-slate-300 bg-slate-100 text-slate-700",
};

export function Board({ columns, isAdmin }: { columns: BoardColumn[]; isAdmin: boolean }) {
  const router = useRouter();
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  const cards = columns.flatMap((c) => c.cards);
  const stageName = (n: number) => columns.find((c) => c.number === n)?.name ?? `Stage ${n}`;

  function open(p: Pending) {
    setPending(p);
    setComment("");
    setError(null);
    dialog.current?.showModal();
  }
  function close() {
    dialog.current?.close();
    setPending(null);
  }

  async function post(card: BoardCard, target: number, body: { comment?: string; override?: boolean } = {}) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/opportunities/${card.id}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, ...body }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        close();
        router.refresh();
      } else if (res.status === 409 && Array.isArray(data.unmet)) {
        open({ kind: "blocked", card, target, unmet: data.unmet });
      } else {
        if (!dialog.current?.open) open({ kind: "blocked", card, target, unmet: [] });
        setError(data.error ?? "The move failed. Try again.");
      }
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function move(id: string, target: number) {
    const card = cards.find((c) => c.id === id);
    if (!card || card.stage === target) return;
    if (target < card.stage) open({ kind: "backward", card, target });
    else void post(card, target);
  }

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-4" data-testid="board">
        {columns.map((col) => (
          <section
            key={col.number}
            aria-label={`Stage ${col.number}: ${col.name}`}
            data-stage={col.number}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOver(col.number); }}
            onDragLeave={() => setOver((o) => (o === col.number ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain") || dragId;
              setOver(null);
              setDragId(null);
              if (id) move(id, col.number);
            }}
            className={`flex w-64 shrink-0 flex-col rounded-lg border ${over === col.number ? "border-brand-600 bg-brand-50" : "border-slate-200 bg-slate-100"}`}
          >
            <header className="border-b border-slate-200 px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-sm leading-tight"><span className="text-slate-500">{col.number}</span> {col.name}</h2>
                <span className="text-xs text-slate-500">{col.cards.length}</span>
              </div>
              <div className="mt-1 text-sm font-semibold" data-testid="column-total">{col.total}</div>
              <div className="text-xs text-slate-500">{col.timed} timed · {col.untimed} untimed</div>
            </header>
            <ul className="flex min-h-24 flex-1 flex-col gap-2 p-2">
              {col.cards.map((c) => (
                <li
                  key={c.id}
                  draggable
                  data-testid="opp-card"
                  data-opp={c.name}
                  onDragStart={(e) => { e.dataTransfer.setData("text/plain", c.id); e.dataTransfer.effectAllowed = "move"; setDragId(c.id); }}
                  onDragEnd={() => { setDragId(null); setOver(null); }}
                  className={`cursor-grab rounded-md border border-slate-200 bg-white p-2.5 shadow-xs ${dragId === c.id ? "opacity-50" : ""}`}
                >
                  <div className="truncate text-xs text-slate-500">{c.org ?? "No organization"}</div>
                  <Link href={`/opportunities/${c.id}`} className="block leading-snug font-medium text-slate-900">{c.name}</Link>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="font-semibold" title={`TCV (${c.tcvFlag.toLowerCase()})`}>{c.tcv}</span>
                    <span className="flex items-center gap-1">
                      {c.branch && <span className="chip" title={`Deployment branch ${c.branch}`}>{c.branch}</span>}
                      <span className={`chip ${TIER[c.tier] ?? ""}`}>{c.tier}</span>
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1" role="img" aria-label={c.dots.map((d) => `${d.label}: ${d.rating.toLowerCase()}`).join(", ")}>
                      {c.dots.map((d) => (
                        <span
                          key={d.label}
                          title={`${d.label}: ${d.rating.toLowerCase()}${d.stale ? " (stale)" : ""}`}
                          data-rating={d.rating}
                          className={`inline-block h-2.5 w-2.5 rounded-full border ${DOT[d.rating]} ${d.stale ? "opacity-35" : ""}`}
                        />
                      ))}
                    </span>
                    <span className="text-xs text-slate-500">{c.awardWindow}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span title={`Owner: ${c.owner}`} className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700">
                        {c.ownerInitials}
                      </span>
                      <span className={c.touchDays !== null && c.touchDays > 30 ? "font-medium text-red-700" : ""}>
                        {c.touchDays === null ? "No touch yet" : c.touchDays === 0 ? "Touched today" : `${c.touchDays}d since touch`}
                      </span>
                    </span>
                    {c.status === "ON_HOLD" && <span className="chip border-amber-300 bg-amber-50 text-amber-800" title={c.holdReason ?? ""}>On hold</span>}
                    {c.status === "WON" && <span className="chip border-green-300 bg-green-50 text-green-800">Won</span>}
                    {(c.status === "LOST" || c.status === "NO_BID") && <span className="chip">{c.status === "LOST" ? "Lost" : "No-bid"}</span>}
                  </div>
                  {/* Keyboard / touch alternative to dragging */}
                  <label className="sr-only" htmlFor={`move-${c.id}`}>Move {c.name} to stage</label>
                  <select
                    id={`move-${c.id}`}
                    value={c.stage}
                    onChange={(e) => move(c.id, Number(e.target.value))}
                    className="!mt-2 !py-0.5 !text-xs text-slate-600"
                  >
                    {columns.map((s) => <option key={s.number} value={s.number}>{s.number === c.stage ? "Move to…" : `${s.number} ${s.name}`}</option>)}
                  </select>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <dialog ref={dialog} onClose={() => setPending(null)} className="m-auto w-full max-w-lg rounded-lg border border-slate-200 p-0 shadow-xl backdrop:bg-slate-900/40" aria-labelledby="move-title">
        {pending && (
          <form
            className="space-y-3 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              void post(pending.card, pending.target, { comment, override: pending.kind === "blocked" });
            }}
          >
            {pending.kind === "blocked" ? (
              <>
                <h2 id="move-title">Can’t move to {stageName(pending.target)} yet</h2>
                {pending.unmet.length > 0 && (
                  <p className="text-sm text-slate-600">
                    <strong>{pending.card.name}</strong> hasn’t met these exit criteria:
                  </p>
                )}
                <div data-testid="unmet-gates" className="max-h-72 space-y-2 overflow-y-auto">
                  {pending.unmet.map((u) => (
                    <div key={u.stage}>
                      <div className="text-xs font-semibold text-slate-500 uppercase">{u.stage}. {u.name}</div>
                      <ul className="ml-5 list-disc text-sm">{u.items.map((i) => <li key={i}>{i}</li>)}</ul>
                    </div>
                  ))}
                </div>
                {isAdmin && pending.unmet.length > 0 && (
                  <div className="border-t border-slate-200 pt-3">
                    <label htmlFor="override-comment">Admin override — comment (required, logged)</label>
                    <textarea id="override-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
                  </div>
                )}
              </>
            ) : (
              <>
                <h2 id="move-title">Move back to {stageName(pending.target)}?</h2>
                <p className="text-sm text-slate-600">
                  <strong>{pending.card.name}</strong> will move from {stageName(pending.card.stage)} back to {stageName(pending.target)}. The reason is logged.
                </p>
                <div>
                  <label htmlFor="back-reason">Reason</label>
                  <textarea id="back-reason" required value={comment} onChange={(e) => setComment(e.target.value)} rows={2} autoFocus />
                </div>
              </>
            )}
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              {pending.kind === "blocked" && <Link className="btn" href={`/opportunities/${pending.card.id}`}>Open opportunity</Link>}
              <button type="button" className="btn" onClick={close}>{pending.kind === "blocked" ? "Close" : "Cancel"}</button>
              {pending.kind === "backward" && <button className="btn btn-primary" disabled={busy || !comment.trim()}>Move back</button>}
              {pending.kind === "blocked" && isAdmin && pending.unmet.length > 0 && (
                <button className="btn btn-danger" disabled={busy || !comment.trim()}>Override gate</button>
              )}
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
