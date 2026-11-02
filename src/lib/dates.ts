// All dates are plain 'YYYY-MM-DD' strings in the school's own calendar
// (the database works out "today" in the school's time zone).

const toUTC = (d: string) => new Date(`${d}T00:00:00Z`);
const iso = (dt: Date) => dt.toISOString().slice(0, 10);

export function addDays(d: string, n: number) {
  const dt = toUTC(d);
  dt.setUTCDate(dt.getUTCDate() + n);
  return iso(dt);
}

/** Monday of the week containing d. */
export function weekStart(d: string) {
  const dow = toUTC(d).getUTCDay(); // 0 = Sunday
  return addDays(d, dow === 0 ? -6 : 1 - dow);
}

export function monthStart(d: string) {
  return `${d.slice(0, 7)}-01`;
}

export function monthEnd(d: string) {
  const dt = toUTC(monthStart(d));
  dt.setUTCMonth(dt.getUTCMonth() + 1);
  dt.setUTCDate(0);
  return iso(dt);
}

export function prevMonthStart(d: string) {
  const dt = toUTC(monthStart(d));
  dt.setUTCMonth(dt.getUTCMonth() - 1);
  return iso(dt);
}

export function isDate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toUTC(s).getTime());
}

export function fmtDay(d: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(toUTC(d));
}

export function fmtLongDay(d: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(toUTC(d));
}

export function fmtMonth(d: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" }).format(toUTC(d));
}

export function fmtTime(ts: string, timeZone = "Asia/Dubai") {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" }).format(new Date(ts));
}

export type Period = "week" | "month" | "last-month";

export function periodRange(period: Period, today: string): { from: string; to: string; label: string } {
  if (period === "week") return { from: weekStart(today), to: today, label: "This week" };
  if (period === "last-month") {
    const from = prevMonthStart(today);
    return { from, to: monthEnd(from), label: fmtMonth(from) };
  }
  return { from: monthStart(today), to: today, label: "This month" };
}
