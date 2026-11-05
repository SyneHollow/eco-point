// This month's badges for one class, plus earlier months. No hooks: server or client.
import { BadgeEmblem } from "@/components/badges";
import { cx } from "@/components/ui";
import { fmtMonth } from "@/lib/dates";
import { pts } from "@/lib/format";
import type { ClassBadges } from "@/lib/rewards";

export function BadgeShelf({ badges }: { badges: ClassBadges }) {
  const next = badges.tiers.find((t) => !t.reached);
  return (
    <section className="rounded-xl border border-line bg-white p-5" aria-labelledby="badges-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="badges-title" className="text-xl font-bold">
          Badges for {fmtMonth(badges.month)}
        </h2>
        <p className="text-stone-500">
          <span className="font-display tabular text-2xl font-extrabold text-pitch">{pts(badges.points)}</span> points this month
        </p>
      </div>
      <p className="mt-1 max-w-2xl text-stone-600">
        Your class earns a badge when its points this month reach the target. Badges start again each month; plants you win stay in your garden.
      </p>
      <ul className="mt-5 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
        {badges.tiers.map((t) => (
          <li key={t.code} className="flex flex-col items-center text-center">
            <BadgeEmblem code={t.code} earned={t.reached} size={76} />
            <p className={cx("mt-2 font-bold", !t.reached && "text-stone-500")}>{t.name}</p>
            <p className="text-sm text-stone-500">
              {t.threshold} points{t.reached ? ", earned" : ""}
            </p>
            {t.reward_name && <p className="text-sm text-leaf-600">Wins a {t.reward_name}</p>}
          </li>
        ))}
      </ul>
      {next && (
        <div className="mt-5">
          <div className="h-3 overflow-hidden rounded-full bg-stone-100" aria-hidden="true">
            <div className="h-full rounded-full bg-sun-500" style={{ width: `${Math.min(100, (badges.points / next.threshold) * 100)}%` }} />
          </div>
          <p className="mt-2 text-stone-600">
            <strong className="text-pitch">{Math.ceil(next.threshold - badges.points)} more points</strong> this month for {next.name}.
          </p>
        </div>
      )}
      {badges.history.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <h3 className="font-bold">Earlier months</h3>
          <ul className="mt-2 flex flex-wrap gap-3">
            {badges.history.map((h) => (
              <li key={h.month} className="flex items-center gap-2 rounded-full border border-line py-1 pr-3 pl-1">
                <BadgeEmblem code={h.code} size={28} />
                <span>
                  {fmtMonth(h.month)}: <strong>{h.name}</strong>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
