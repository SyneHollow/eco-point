import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { LeaderList, Podium } from "@/components/leaderboard";
import { Banner, cx, Footer, SdgChips } from "@/components/ui";
import { getChampions, getImpact, getLeaderboard, getSchool, rerank } from "@/lib/public-data";
import { fmtDay, fmtLongDay, fmtMonth, periodRange, type Period } from "@/lib/dates";
import { num, pct, pts } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leaderboard" };

const PERIODS: Period[] = ["week", "month", "last-month"];

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ period?: string; grade?: string }> }) {
  const sp = await searchParams;
  const period: Period = PERIODS.includes(sp.period as Period) ? (sp.period as Period) : "month";
  const school = await getSchool();
  if (!school) return <p className="p-8">School not set up.</p>;

  const range = periodRange(period, school.today);
  const [all, impact, champions] = await Promise.all([getLeaderboard(range.from, range.to), getImpact(range.from, range.to), getChampions()]);
  const grades = [...new Set(all.map((r) => r.grade))].sort((a, b) => a - b);
  const grade = grades.includes(Number(sp.grade)) ? Number(sp.grade) : null;
  const rows = grade ? rerank(all.filter((r) => r.grade === grade)) : all;
  const champ = champions[0];
  const link = (p: Period, g: number | null) => `/leaderboard?period=${p}${g ? `&grade=${g}` : ""}`;

  return (
    <>
      <PublicHeader schoolName={school.name} />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-leaf-900">Leaderboard</h1>
            <p className="text-sm text-stone-500">
              {range.label}: {fmtDay(range.from)} – {fmtDay(range.to)} · updates live
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {PERIODS.map((p) => (
              <Link key={p} href={link(p, grade)} className={cx("rounded-full px-4 py-2 text-sm font-bold ring-1", p === period ? "bg-leaf-700 text-white ring-leaf-700" : "bg-white text-leaf-800 ring-leaf-700/20")}>
                {periodRange(p, school.today).label}
              </Link>
            ))}
          </div>
        </div>

        {grades.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <Link href={link(period, null)} className={cx("rounded-full px-3 py-1.5 text-xs font-bold ring-1", !grade ? "bg-leaf-100 text-leaf-800 ring-leaf-500/40" : "bg-white text-stone-600 ring-stone-200")}>
              All grades
            </Link>
            {grades.map((g) => (
              <Link key={g} href={link(period, g)} className={cx("rounded-full px-3 py-1.5 text-xs font-bold ring-1", grade === g ? "bg-leaf-100 text-leaf-800 ring-leaf-500/40" : "bg-white text-stone-600 ring-stone-200")}>
                Grade {g}
              </Link>
            ))}
          </div>
        )}

        {school.baseline && school.points_start_date && (
          <Banner>Measuring week: habits are being recorded with no points yet. Points begin on {fmtLongDay(school.points_start_date)}.</Banner>
        )}
        {champ?.class_name && (
          <Banner tone="leaf">
            🏆 Green Champion of {fmtMonth(champ.month)}: <strong>{champ.class_name}</strong> with {pts(champ.points)} points
            {champ.was_tie ? " (decided on most days submitted after a tie)" : ""}
          </Banner>
        )}

        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          <div className="space-y-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-leaf-900/5">
            {rows.some((r) => r.points > 0) ? <Podium rows={rows} /> : <p className="py-6 text-center text-stone-500">No points in this period yet.</p>}
            <LeaderList rows={rows} />
            <p className="text-xs text-stone-500">
              Points: daily class check (counts are scored as a share of students present, so big and small classes compete fairly) + peer check by another class + teacher bonuses.
            </p>
          </div>

          {impact && (
            <div className="space-y-3 rounded-2xl bg-leaf-800 p-5 text-white">
              <h2 className="font-display text-xl font-semibold">Together, {range.label.toLowerCase()}</h2>
              <p className="text-sm text-leaf-200">
                From {num(impact.entries)} daily class checks and {num(impact.audits)} peer checks.
              </p>
              <ul className="space-y-2">
                {impact.items.map((it) => (
                  <li key={it.code} className="rounded-xl bg-white/5 px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-bold">{it.label}</span>
                      <span className="tabular font-display text-2xl font-bold text-sun-300">{pct(it.pct)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-xs text-leaf-200">
                      <span>
                        {it.input_type === "count" ? `${num(it.total)} times` : `${num(it.total)} of ${num(it.answers)} checks passed`}
                      </span>
                      <SdgChips sdgs={it.sdgs} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
