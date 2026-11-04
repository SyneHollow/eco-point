import type { CSSProperties } from "react";
import type { LeaderRow } from "@/lib/types";
import { pts } from "@/lib/format";
import { cx, Empty, Medal, TeamTile, teamColor } from "@/components/ui";

type Size = "md" | "tv";

const POD = {
  md: { col: "w-[30%] max-w-40", h: { 1: 184, 2: 140, 3: 112 }, code: "text-5xl sm:text-6xl", points: "text-2xl sm:text-3xl", medal: 34 },
  tv: { col: "w-56", h: { 1: 330, 2: 260, 3: 200 }, code: "text-8xl", points: "text-4xl", medal: 60 },
} as const;

/**
 * Top three as team-coloured podium columns (2nd, 1st, 3rd). Columns rise once on load;
 * 3rd goes first so 1st lands last. Respects reduced motion via globals.css.
 */
export function Podium({ rows, size = "md" }: { rows: LeaderRow[]; dark?: boolean; size?: Size }) {
  const top = rows.filter((r) => r.points > 0).slice(0, 3);
  if (top.length === 0) return null;
  const s = POD[size];
  const order = [top[1], top[0], top[2]].filter(Boolean) as LeaderRow[];
  const delay: Record<number, number> = { 3: 0, 2: 140, 1: 280 };
  return (
    <div className={cx("flex items-end justify-center", size === "tv" ? "gap-6" : "gap-2 [--pod:1] sm:gap-3 md:[--pod:1.35]")}>
      {order.map((r) => {
        const d = delay[r.rank] ?? 0;
        return (
          <div key={r.class_id} className={cx("flex flex-col items-center", s.col)}>
            <div className="podium-label mb-2" style={{ animationDelay: `${d + 420}ms` } as CSSProperties}>
              <Medal rank={r.rank} size={s.medal} />
            </div>
            <div
              className="podium-col flex w-full flex-col items-center rounded-t-xl pt-3 text-pitch shadow-[inset_0_-6px_0_rgb(13_59_46/0.15)]"
              style={{ height: `calc(${s.h[r.rank as 1 | 2 | 3] ?? 96}px * var(--pod, 1))`, background: teamColor(r.class_name), animationDelay: `${d}ms` }}
            >
              <span className={cx("font-display font-black", s.code)}>{r.class_name}</span>
              <span className={cx("font-display tabular mt-1 font-bold", s.points)}>
                {pts(r.points)}
                <span className={size === "tv" ? "ml-2 text-3xl" : "ml-1 text-base"}>pts</span>
              </span>
            </div>
          </div>
        );
      })}
      <span className="sr-only">
        {top.map((r) => `${r.rank}. ${r.class_name}, ${pts(r.points)} points`).join("; ")}
      </span>
    </div>
  );
}

/** League table: rank, class bib, progress bar, points. One list with dividers rather than a stack of cards. */
export function LeaderList({
  rows,
  highlight,
  dark = false,
  limit,
  size = "md",
}: {
  rows: LeaderRow[];
  highlight?: string | null;
  dark?: boolean;
  limit?: number;
  size?: Size;
}) {
  if (rows.length === 0) return <Empty>No classes yet.</Empty>;
  const tv = size === "tv";
  const max = Math.max(1, ...rows.map((r) => r.points));
  const shown = limit ? rows.slice(0, limit) : rows;
  return (
    <ol className={cx(tv ? "space-y-2" : "divide-y", dark ? "divide-white/10" : "divide-line")}>
      {shown.map((r) => {
        const lead = r.rank === 1 && r.points > 0;
        const mine = highlight === r.class_name;
        return (
          <li
            key={r.class_id}
            className={cx(
              "flex items-center",
              tv ? "gap-6 rounded-xl bg-white/[0.06] px-5 py-1.5" : "gap-3 px-1 py-2.5 sm:gap-4",
              mine && (dark ? "outline-2 outline-sun-500" : "rounded-lg bg-sun-100"),
            )}
          >
            <span className={cx("flex shrink-0 justify-center", tv ? "w-14 text-5xl" : "w-9 text-2xl", dark ? "text-leaf-200" : "text-stone-500")}>
              <Medal rank={r.rank} size={tv ? 50 : 30} />
            </span>
            <TeamTile name={r.class_name} size={tv ? "tv" : "sm"} />
            <span
              className={cx("relative flex-1 overflow-hidden rounded-full", tv ? "h-4" : "h-2.5", dark ? "bg-white/12" : "bg-stone-100")}
              aria-hidden="true"
            >
              <span
                className={cx("absolute inset-y-0 left-0 rounded-full", lead ? "bg-sun-500" : dark ? "bg-leaf-300" : "bg-leaf-600")}
                style={{ width: `${Math.max(2, (r.points / max) * 100)}%` }}
              />
            </span>
            {!tv && (
              <span className={cx("tabular hidden w-16 text-right text-sm sm:inline", dark ? "text-leaf-200" : "text-stone-500")}>
                {r.days_submitted} day{r.days_submitted === 1 ? "" : "s"}
              </span>
            )}
            <span className={cx("font-display tabular text-right font-extrabold", tv ? "w-36 text-6xl" : "w-20 text-3xl", dark ? "text-white" : "text-pitch")}>
              {pts(r.points)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
