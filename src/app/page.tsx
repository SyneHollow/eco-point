import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { LeaderList, Podium } from "@/components/leaderboard";
import { Banner, ButtonLink, Footer, TeamTile } from "@/components/ui";
import { Icon } from "@/components/icons";
import { getChampions, getLeaderboard, getSchool } from "@/lib/public-data";
import { getMe } from "@/lib/session";
import { fmtLongDay, fmtMonth, monthEnd, periodRange } from "@/lib/dates";
import { pts } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const school = await getSchool();
  if (!school) return <NotSetUp />;
  const month = periodRange("month", school.today);
  const [rows, champions, me] = await Promise.all([getLeaderboard(month.from, month.to), getChampions(), getMe()]);
  const champ = champions[0];
  const hasPoints = rows.some((r) => r.points > 0);
  const day = Number(school.today.slice(8, 10));
  const days = Number(monthEnd(school.today).slice(8, 10));
  const monthName = fmtMonth(month.from).split(" ")[0];

  return (
    <>
      <PublicHeader schoolName={school.name} />

      {/* Hero: the live standings. The podium stands on the band's bottom edge. */}
      <section className="on-dark bg-pitch text-white">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 pt-8 md:grid-cols-[1fr_1.1fr] md:items-end md:pt-12">
          <div className="md:pb-12">
            <p className="font-semibold text-leaf-200">
              <span className="sm:hidden">{school.name}: </span>
              Day {day} of {days}
            </p>
            <h1 className="font-display mt-2 text-7xl font-black sm:text-8xl">{monthName} standings</h1>
            <p className="mt-4 max-w-md text-lg text-leaf-100">
              Every class scores points for its daily eco habits. Another class checks each one, so it stays fair.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {me ? (
                <ButtonLink href={me.role === "teacher" ? "/teacher" : "/monitor"} variant="light">
                  {me.role === "teacher" ? "Go to teacher dashboard" : `Go to ${me.class_name}'s check`}
                </ButtonLink>
              ) : (
                <>
                  <ButtonLink href="/login" variant="light">Eco Monitor login</ButtonLink>
                  <ButtonLink href="/login?as=teacher" variant="ghostDark">Teacher login</ButtonLink>
                </>
              )}
            </div>
          </div>
          <div className="min-h-24">
            {hasPoints ? (
              <Podium rows={rows} />
            ) : (
              <p className="mb-10 rounded-xl border border-dashed border-white/30 px-5 py-8 text-center text-lg text-leaf-100">
                No points yet this month. The first class checks will appear here.
              </p>
            )}
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8">
        {school.baseline && school.points_start_date && (
          <Banner>
            Measuring week: classes are recording their habits so we know where we started. Points begin on {fmtLongDay(school.points_start_date)}.
          </Banner>
        )}

        <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
          <section className="rounded-xl border border-line bg-white px-4 pt-4 pb-2 sm:px-5" aria-labelledby="table-title">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="table-title" className="text-lg font-bold">Full table</h2>
              <Link href="/leaderboard" className="rounded font-bold text-leaf-600 underline-offset-4 hover:underline">
                Week and grade views
              </Link>
            </div>
            <div className="mt-2">
              <LeaderList rows={rows} />
            </div>
          </section>

          <div className="space-y-4">
            <section className="rounded-xl border border-line bg-white p-5">
              <h2 className="flex items-center gap-2 font-bold text-stone-500">
                <Icon name="trophy" size={18} />
                Last Green Champion
              </h2>
              {champ?.class_name ? (
                <div className="mt-3 flex items-center gap-4">
                  <TeamTile name={champ.class_name} size="lg" />
                  <div>
                    <p className="font-bold">{fmtMonth(champ.month)}</p>
                    <p className="font-display tabular text-3xl font-extrabold">
                      {pts(champ.points)} <span className="text-lg">points</span>
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-stone-600">Announced when the first month closes.</p>
              )}
            </section>
            <Link
              href="/display"
              className="group flex items-start gap-3 rounded-xl border border-line bg-white p-5 transition-colors hover:border-pitch"
            >
              <Icon name="tv" size={24} className="mt-0.5 shrink-0 text-leaf-600" />
              <span>
                <span className="block font-bold group-hover:underline group-hover:underline-offset-4">Open the corridor screen</span>
                <span className="mt-0.5 block text-stone-500">Full-screen standings for the school&apos;s display board.</span>
              </span>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function NotSetUp() {
  return (
    <main className="mx-auto max-w-xl flex-1 px-4 py-16 text-center">
      <h1 className="font-display text-5xl font-black">EcoPoints isn&apos;t set up yet</h1>
      <p className="mt-3 text-stone-600">
        No school matches this app&apos;s school code. Run <code>supabase/seed.sql</code> and check <code>NEXT_PUBLIC_SCHOOL_SLUG</code>.
      </p>
    </main>
  );
}
