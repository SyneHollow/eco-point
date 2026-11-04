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
    <div className="flex min-h-screen flex-col bg-leaf-950 text-white">
      <AutoRefresh seconds={60} />
      <header className="flex items-center justify-between px-10 py-6">
        <Logo dark size="lg" />
        <div className="text-right">
          <div className="font-display text-2xl font-semibold">{school.name}</div>
          <div className="text-leaf-200">
            {fmtLongDay(school.today)} · <Clock timeZone={school.timezone} />
          </div>
        </div>
      </header>
      {school.baseline && school.points_start_date && (
        <div className="mx-10 rounded-2xl bg-sun-500 px-6 py-3 text-lg font-bold text-leaf-950">
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
      <footer className="px-10 py-4 text-sm text-leaf-200/70">
        Points come from daily class checks, fair peer checks, AI-checked bin photos and teacher bonuses · Built with Nexayra Technologies
      </footer>
    </div>
  );
}
