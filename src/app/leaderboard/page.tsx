import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { LeaderList, Podium } from "@/components/leaderboard";
import { Banner, cx, Footer, SdgChips } from "@/components/ui";
import { Icon } from "@/components/icons";
import { getAiSummary, getBadges, getChampions, getImpact, getLeaderboard, getSchool, rerank } from "@/lib/public-data";
import { BadgeEmblem } from "@/components/badges";
import { TeamTile } from "@/components/ui";
import { fmtDay, fmtLongDay, fmtMonth, monthStart, periodRange, type Period } from "@/lib/dates";
import { num, pct, plural, pts } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leaderboard" };

const PERIODS: Period[] = ["week", "month", "last-month"];

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ period?: string; grade?: string }> }) {
  const sp = await searchParams;
  const period: Period = PERIODS.includes(sp.period as Period) ? (sp.period as Period) : "month";
  const school = await getSchool();
  if (!school) return <p className="p-8">School not set up.</p>;

  const range = periodRange(period, school.today);
  const badgeMonth = period === "last-month" ? range.from : monthStart(school.today);
  const [all, impact, champions, ai, badgesAll] = await Promise.all([
    getLeaderboard(range.from, range.to),
    getImpact(range.from, range.to),
    getChampions(),
    getAiSummary(range.from, range.to),
    getBadges(badgeMonth),
  ]);
  const grades = [...new Set(all.map((r) => r.grade))].sort((a, b) => a - b);
  const grade = grades.includes(Number(sp.grade)) ? Number(sp.grade) : null;
  const rows = grade ? rerank(all.filter((r) => r.grade === grade)) : all;
  const champ = champions[0];
  const link = (p: Period, g: number | null) => `/leaderboard?period=${p}${g ? `&grade=${g}` : ""}`;

  const seg = (active: boolean) =>
    cx(
      "inline-flex min-h-11 items-center rounded-[10px] px-4 font-bold transition-colors",
      active ? "bg-white text-pitch" : "border-[1.5px] border-white/25 text-leaf-100 hover:border-white hover:text-white",
    );

  return (
    <>
      <PublicHeader schoolName={school.name} current="leaderboard" />
      <section className="on-dark bg-pitch text-white">
        <div className="mx-auto max-w-5xl px-4 pt-8">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div>
              <h1 className="font-display text-7xl font-black">Leaderboard</h1>
              <p className="mt-2 text-leaf-200">
                {range.label}, {fmtDay(range.from)} to {fmtDay(range.to)}. Updates as classes submit.
              </p>
            </div>
            <nav aria-label="Period" className="flex flex-wrap gap-2">
              {PERIODS.map((p) => (
                <Link key={p} href={link(p, grade)} aria-current={p === period ? "page" : undefined} className={seg(p === period)}>
                  {periodRange(p, school.today).label}
                </Link>
              ))}
            </nav>
          </div>
          {grades.length > 1 && (
            <nav aria-label="Grade" className="mt-4 flex flex-wrap gap-2 text-[15px]">
              <Link href={link(period, null)} aria-current={!grade ? "page" : undefined} className={cx(seg(!grade), "min-h-10 px-3")}>
                All grades
              </Link>
              {grades.map((g) => (
                <Link key={g} href={link(period, g)} aria-current={grade === g ? "page" : undefined} className={cx(seg(grade === g), "min-h-10 px-3")}>
                  Grade {g}
                </Link>
              ))}
            </nav>
          )}
          <div className="mt-8">
            {rows.some((r) => r.points > 0) ? (
              <Podium rows={rows} />
            ) : (
              <p className="mb-10 rounded-xl border border-dashed border-white/30 px-5 py-8 text-center text-lg text-leaf-100">
                No points in this period yet.
              </p>
            )}
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8">
        {school.baseline && school.points_start_date && (
          <Banner>Measuring week: habits are being recorded with no points yet. Points begin on {fmtLongDay(school.points_start_date)}.</Banner>
        )}
        {champ?.class_name && (
          <Banner tone="leaf">
            Green Champion of {fmtMonth(champ.month)}: <strong>{champ.class_name}</strong> with {pts(champ.points)} points
            {champ.was_tie ? " (decided on most days submitted after a tie)" : ""}
          </Banner>
        )}

        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          <section className="rounded-xl border border-line bg-white px-4 pt-4 pb-3 sm:px-5" aria-labelledby="table-title">
            <h2 id="table-title" className="text-lg font-bold">
              Table{grade ? `, grade ${grade}` : ""}
            </h2>
            <div className="mt-2">
              <LeaderList rows={rows} />
            </div>
            <p className="mt-3 border-t border-line pt-3 text-sm text-stone-500">
              Points come from the daily class check, a peer check by another class, and teacher bonuses. Counts are scored as a share of
              students present, so big and small classes compete fairly.
            </p>
          </section>

          {impact && (
            <section className="rounded-xl border border-line bg-white p-5" aria-labelledby="together-title">
              <h2 id="together-title" className="text-lg font-bold">
                Together, {range.label.toLowerCase()}
              </h2>
              <p className="mt-1 text-[15px] text-stone-500">
                From {plural(impact.entries, "daily class check")} and {plural(impact.audits, "peer check")}.
              </p>
              <ul className="mt-3 divide-y divide-line">
                {impact.items.map((it) => (
                  <li key={it.code} className="py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-bold">{it.label}</span>
                      <span className="font-display tabular text-4xl font-extrabold">{pct(it.pct)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-sm text-stone-500">
                      <span>
                        {it.input_type === "count" ? plural(it.total, "time") : `${num(it.total)} of ${plural(it.answers, "check")} passed`}
                      </span>
                      <SdgChips sdgs={it.sdgs} />
                    </div>
                  </li>
                ))}
              </ul>
              {ai && ai.bin_checks > 0 && ai.per_10_students !== null && (
                <div className="mt-2 rounded-[10px] bg-lagoon-100 px-4 py-3 text-lagoon-700">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex items-center gap-1.5 font-bold">
                      <Icon name="scan" size={18} />
                      Plastic in class bins (AI-checked)
                    </span>
                    <span className="font-display tabular text-4xl font-extrabold">{ai.per_10_students}</span>
                  </div>
                  <div className="mt-1 text-sm">
                    Plastic items per 10 students, from {plural(ai.bin_checks, "bin photo")}. Lower is better.
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        <section className="rounded-xl border border-line bg-white p-5" aria-labelledby="badges-title">
          <h2 id="badges-title" className="text-lg font-bold">Badges for {fmtMonth(badgeMonth)}</h2>
          <p className="mt-1 text-[15px] text-stone-500">A class earns a badge when its points in the month reach the target. Every class can earn every badge.</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(grade ? badgesAll.filter((b) => b.grade === grade) : badgesAll).map((b) => (
              <li key={b.class_id} className="flex items-center gap-3 rounded-xl border border-line p-3">
                <TeamTile name={b.class_name} size="sm" />
                {b.tier_code ? <BadgeEmblem code={b.tier_code} size={44} /> : <BadgeEmblem code="tiny_sprout" earned={false} size={44} />}
                <div className="min-w-0">
                  <p className="font-bold">{b.tier_name ?? "No badge yet"}</p>
                  <p className="text-sm text-stone-500">
                    {b.next_threshold !== null ? `${Math.ceil(b.next_threshold - b.points)} more for ${b.next_name}` : "Every badge earned"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <Footer />
    </>
  );
}
