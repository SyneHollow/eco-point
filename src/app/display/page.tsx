import { AutoRefresh, Clock } from "@/components/client";
import { Logo } from "@/components/ui";
import { getAiSummary, getChallenges, getChampions, getImpact, getLeaderboard, getSchool } from "@/lib/public-data";
import { fmtLongDay, fmtMonth, periodRange, weekStart } from "@/lib/dates";
import { DisplaySlides } from "./slides";

export const dynamic = "force-dynamic";
export const metadata = { title: "Corridor screen" };

export default async function DisplayPage() {
  const school = await getSchool();
  if (!school) return <p className="p-8">School not set up.</p>;
  const month = periodRange("month", school.today);
  const week = periodRange("week", school.today);
  const [monthRows, weekRows, impact, champions, ai, challenges] = await Promise.all([
    getLeaderboard(month.from, month.to),
    getLeaderboard(week.from, week.to),
    getImpact(month.from, month.to),
    getChampions(),
    getAiSummary(month.from, month.to),
    getChallenges(weekStart(school.today)),
  ]);

  return (
    <div className="on-dark flex h-dvh flex-col overflow-hidden bg-pitch text-white">
      <AutoRefresh seconds={60} />
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-12 py-5">
        <Logo dark size="lg" />
        <div className="flex items-center gap-8 text-right">
          <div>
            <div className="text-2xl font-bold">{school.name}</div>
            <div className="text-xl text-leaf-200">{fmtLongDay(school.today)}</div>
          </div>
          <div className="font-display tabular text-6xl font-extrabold">
            <Clock timeZone={school.timezone} />
          </div>
        </div>
      </header>
      {school.baseline && school.points_start_date && (
        <div className="mx-12 mt-6 rounded-xl bg-sun-500 px-6 py-3 text-2xl font-bold text-pitch">
          Measuring week: we&apos;re finding out where we start. Points begin {fmtLongDay(school.points_start_date)}.
        </div>
      )}
      <DisplaySlides
        monthLabel={fmtMonth(month.from)}
        monthRows={monthRows}
        weekRows={weekRows}
        impact={impact}
        champion={champions[0] ?? null}
        ai={ai}
        challenges={challenges}
      />
      <footer className="flex justify-between gap-8 px-12 py-5 text-lg text-leaf-200">
        <span>Points come from daily class checks, fair peer checks, AI-checked bin photos and teacher bonuses.</span>
      </footer>
    </div>
  );
}
