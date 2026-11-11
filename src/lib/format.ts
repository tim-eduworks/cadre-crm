export function money(v: number | string | { toString(): string } | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

/** Compact dollars for cards and column totals: $1.2M, $450K. */
export function moneyShort(v: number | string | { toString(): string } | null | undefined): string {
  const n = Number(v ?? 0);
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1)}M`;
  if (Math.abs(n) >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
}

export function date(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

export function dateInput(d: Date | string | null | undefined): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

export function daysSince(d: Date | string | null | undefined, now = new Date()): number | null {
  if (!d) return null;
  return Math.max(0, Math.floor((now.getTime() - new Date(d).getTime()) / 86_400_000));
}

export function personName(p: { firstName?: string | null; lastName?: string | null } | null | undefined): string {
  if (!p) return "—";
  return [p.firstName, p.lastName].filter(Boolean).join(" ") || "(no name)";
}

export function userName(u: { name?: string | null; email: string } | null | undefined): string {
  return u ? u.name || u.email : "—";
}

export function initials(name: string): string {
  return name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    let s = v === null || v === undefined ? "" : String(v);
    // Neutralize spreadsheet formula injection from user-entered text.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n";
}
