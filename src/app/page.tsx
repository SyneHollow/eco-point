import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { Podium } from "@/components/leaderboard";
import { Banner, ButtonLink, Footer } from "@/components/ui";
import { getChampions, getLeaderboard, getSchool } from "@/lib/public-data";
import { getMe } from "@/lib/session";
import { fmtLongDay, fmtMonth, periodRange } from "@/lib/dates";
import { pts } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const school = await getSchool();
  if (!school) return <NotSetUp />;
  const month = periodRange("month", school.today);
  const [rows, champions, me] = await Promise.all([getLeaderboard(month.from, month.to), getChampions(), getMe()]);
  const champ = champions[0];

  return (
    <>
      <PublicHeader schoolName={school.name} />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-4 py-8">
        <section className="overflow-hidden rounded-3xl bg-leaf-800 px-6 py-10 text-white sm:px-10">
          <p className="text-sm font-bold uppercase tracking-wider text-leaf-200">{school.name}</p>
          <h1 className="font-display mt-2 text-4xl font-bold sm:text-5xl">Every class. Every day. Greener together.</h1>
          <p className="mt-3 max-w-2xl text-leaf-100">
            Eco Monitors record their class&apos;s daily eco habits, another class checks them fairly, and points add up to the{" "}
            <span className="font-bold text-sun-300">Green Champion of the Month</span>.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {me ? (
              <ButtonLink href={me.role === "teacher" ? "/teacher" : "/monitor"} variant="sun">
                Go to {me.role === "teacher" ? "teacher dashboard" : `${me.class_name} check`}
              </ButtonLink>
            ) : (
              <>
                <ButtonLink href="/login" variant="sun">Eco Monitor login</ButtonLink>
                <ButtonLink href="/login?as=teacher" variant="secondary">Teacher login</ButtonLink>
              </>
            )}
            <ButtonLink href="/leaderboard" variant="secondary">Full leaderboard</ButtonLink>
          </div>
        </section>

        {school.baseline && school.points_start_date && (
          <Banner>
            Measuring week: classes are recording their habits so we know where we started. Points begin on {fmtLongDay(school.points_start_date)}.
          </Banner>
        )}

        <section className="grid gap-6 md:grid-cols-[2fr_1fr]">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-leaf-900/5">
            <h2 className="font-display text-xl font-semibold text-leaf-900">Top classes this month</h2>
            <div className="mt-6">
              {rows.some((r) => r.points > 0) ? (
                <Podium rows={rows} />
              ) : (
                <p className="py-8 text-center text-stone-500">No points yet this month. The first entries will appear here.</p>
              )}
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl bg-sun-100 p-6 ring-1 ring-sun-500/30">
              <p className="text-xs font-extrabold uppercase tracking-wider text-sun-700">Last Green Champion</p>
              {champ?.class_name ? (
                <>
                  <p className="font-display mt-1 text-4xl font-bold text-leaf-900">{champ.class_name}</p>
                  <p className="text-sm font-semibold text-leaf-800">
                    {fmtMonth(champ.month)} · {pts(champ.points)} pts
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-leaf-800">Announced at the end of the first month.</p>
              )}
            </div>
            <Link href="/display" className="block rounded-2xl bg-white p-6 text-sm font-bold text-leaf-800 shadow-sm ring-1 ring-leaf-900/5 hover:bg-leaf-50">
              Corridor screen →
              <span className="mt-1 block font-normal text-stone-500">Full-screen view for the school&apos;s display board.</span>
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function NotSetUp() {
  return (
    <main className="mx-auto max-w-xl flex-1 px-4 py-16 text-center">
      <h1 className="font-display text-3xl font-bold text-leaf-900">EcoPoints isn&apos;t set up yet</h1>
      <p className="mt-3 text-stone-600">
        No school matches this app&apos;s school code. Run <code>supabase/seed.sql</code> and check <code>NEXT_PUBLIC_SCHOOL_SLUG</code>.
      </p>
    </main>
  );
}
