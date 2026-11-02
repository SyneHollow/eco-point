import Link from "next/link";
import { notFound } from "next/navigation";
import { TrendChart } from "@/components/charts";
import { PrintButton } from "@/components/client";
import { LeaderList } from "@/components/leaderboard";
import { Banner, cx, Logo, SdgChips } from "@/components/ui";
import { addDays, fmtDay, fmtLongDay, fmtMonth, monthEnd } from "@/lib/dates";
import { num, pct, pts } from "@/lib/format";
import { getChampions, getImpact, getLeaderboard } from "@/lib/public-data";
import { requireTeacher } from "@/lib/session";
import { series } from "@/lib/teacher-data";
import type { Impact } from "@/lib/types";

export const metadata = { title: "Impact report" };

export default async function ReportPage({ params }: { params: Promise<{ month: string }> }) {
  const me = await requireTeacher();
  const { month } = await params;
  if (!/^\d{4}-\d{2}$/.test(month)) notFound();
  const from = `${month}-01`;
  if (from > me.today) notFound();
  const end = monthEnd(from);
  const to = end < me.today ? end : me.today;
  const live = to === me.today && end > me.today;

  // "After" = scored days of this month; "before" = the 14 days of baseline before scoring began.
  const start = me.points_start_date;
  const afterFrom = start && start > from ? start : from;
  const hasAfter = afterFrom <= to;
  const baseFrom = start ? addDays(start, -14) : null;
  const baseTo = start ? addDays(start, -1) : null;

  const [impact, after, baseline, board, trend, champs] = await Promise.all([
    getImpact(from, to),
    hasAfter ? getImpact(afterFrom, to) : Promise.resolve(null),
    baseFrom && baseTo ? getImpact(baseFrom, baseTo) : Promise.resolve(null),
    getLeaderboard(from, to),
    series(from, to),
    getChampions(),
  ]);
  const champ = champs.find((c) => c.month === from);
  const showCompare = !!(baseline && baseline.entries > 0 && after && after.entries > 0);

  return (
    <div className="space-y-4">
      <div className="no-print flex items-center justify-between">
        <Link href="/teacher/month" className="font-bold text-leaf-700">← Month close</Link>
        <PrintButton />
      </div>

      <article className="print-plain mx-auto max-w-4xl space-y-8 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-leaf-900/5">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-200 pb-6">
          <div>
            <Logo />
            <h1 className="font-display mt-4 text-3xl font-bold text-leaf-900">Impact report: {fmtMonth(from)}</h1>
            <p className="text-stone-600">
              {me.school_name} · {fmtDay(from)} – {fmtDay(to)}
              {live ? " (month in progress)" : ""}
            </p>
          </div>
          {champ?.class_name && (
            <div className="rounded-2xl bg-sun-100 px-5 py-3 text-right">
              <div className="text-xs font-extrabold uppercase tracking-wider text-sun-700">Green Champion</div>
              <div className="font-display text-3xl font-bold text-leaf-900">{champ.class_name}</div>
              <div className="text-sm font-semibold text-leaf-800">{pts(champ.points)} pts</div>
            </div>
          )}
        </header>

        {impact && (
          <section className="grid gap-4 sm:grid-cols-4">
            <Num label="Daily class checks" value={num(impact.entries)} />
            <Num label="Peer checks" value={num(impact.audits)} />
            <Num label="Eco actions logged" value={num(impact.eco_actions)} />
            <Num label="Points awarded" value={pts(impact.points)} />
          </section>
        )}

        {showCompare && baseline && after ? (
          <section>
            <h2 className="font-display mb-3 text-xl font-semibold text-leaf-900">Before and after</h2>
            <p className="mb-3 text-sm text-stone-600">
              Before = the measuring days up to {fmtDay(baseTo!)}, before points started ({num(baseline.entries)} class checks, no points
              given). After = {fmtDay(afterFrom)} – {fmtDay(to)} ({num(after.entries)} class checks). Change is in percentage points.
            </p>
            <CompareTable baseline={baseline} after={after} />
          </section>
        ) : (
          start === null && (
            <Banner tone="lagoon">
              No measuring week was set, so there&apos;s no &ldquo;before&rdquo; to compare with. Set a points start date in Settings before
              the next cycle to get a before/after comparison.
            </Banner>
          )
        )}

        {impact && (
          <section>
            <h2 className="font-display mb-3 text-xl font-semibold text-leaf-900">Whole month, item by item</h2>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="py-2">Item</th>
                  <th>How it&apos;s measured</th>
                  <th className="text-right">Result</th>
                  <th className="text-right">Count</th>
                  <th className="pl-3">SDGs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {impact.items.map((it) => (
                  <tr key={it.code}>
                    <td className="py-2 font-bold">{it.label}</td>
                    <td className="text-stone-600">
                      {it.input_type === "count" ? "Share of students present" : it.entered_by === "peer" ? "Peer check passed" : "Class says yes"}
                    </td>
                    <td className="tabular text-right font-bold">{pct(it.pct)}</td>
                    <td className="tabular text-right">
                      {it.input_type === "count" ? num(it.total) : `${num(it.total)}/${num(it.answers)}`}
                    </td>
                    <td className="pl-3">
                      <SdgChips sdgs={it.sdgs} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="break-inside-avoid">
          <h2 className="font-display mb-3 text-xl font-semibold text-leaf-900">Day by day (% of the school)</h2>
          <TrendChart rows={trend} height={260} />
        </section>

        <section className="break-inside-avoid">
          <h2 className="font-display mb-3 text-xl font-semibold text-leaf-900">Class standings</h2>
          <LeaderList rows={board} />
        </section>

        <footer className="border-t border-stone-200 pt-4 text-xs text-stone-500">
          All figures are calculated directly from records entered in EcoPoints: counts by each class&apos;s Eco Monitors (as a share of
          students present that day) and yes/no checks by a different class on a daily rotation. Nothing in this report is estimated.
          Generated {fmtLongDay(me.today)}.
        </footer>
      </article>
    </div>
  );
}

function Num({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-leaf-50 px-4 py-3">
      <div className="tabular font-display text-3xl font-bold text-leaf-900">{value}</div>
      <div className="text-xs font-bold uppercase tracking-wide text-stone-500">{label}</div>
    </div>
  );
}

function CompareTable({ baseline, after }: { baseline: Impact; after: Impact }) {
  const before = new Map(baseline.items.map((i) => [i.code, i]));
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs uppercase tracking-wide text-stone-500">
        <tr>
          <th className="py-2">Item</th>
          <th className="text-right">Before</th>
          <th className="text-right">After</th>
          <th className="text-right">Change</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-stone-100">
        {after.items.map((a) => {
          const b = before.get(a.code);
          const diff = a.pct !== null && b?.pct !== null && b?.pct !== undefined ? Number(a.pct) - Number(b.pct) : null;
          return (
            <tr key={a.code}>
              <td className="py-2 font-bold">{a.label}</td>
              <td className="tabular text-right">{pct(b?.pct ?? null)}</td>
              <td className="tabular text-right font-bold">{pct(a.pct)}</td>
              <td className={cx("tabular text-right font-bold", diff === null ? "" : diff >= 0 ? "text-leaf-700" : "text-red-700")}>
                {diff === null ? "–" : `${diff >= 0 ? "▲ +" : "▼ "}${diff.toFixed(0)}`}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
