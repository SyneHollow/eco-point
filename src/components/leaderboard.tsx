import type { LeaderRow } from "@/lib/types";
import { pts } from "@/lib/format";
import { cx, Empty, Medal } from "@/components/ui";

type Size = "md" | "tv";

export function Podium({ rows, dark = false, size = "md" }: { rows: LeaderRow[]; dark?: boolean; size?: Size }) {
  const top = rows.filter((r) => r.points > 0).slice(0, 3);
  if (top.length === 0) return null;
  const tv = size === "tv";
  // visual order: 2nd, 1st, 3rd
  const order = [top[1], top[0], top[2]].filter(Boolean) as LeaderRow[];
  const heights: Record<number, string> = tv
    ? { 1: "h-72", 2: "h-56", 3: "h-44" }
    : { 1: "h-36 sm:h-44", 2: "h-28 sm:h-32", 3: "h-24 sm:h-28" };
  return (
    <div className={cx("flex items-end justify-center", tv ? "gap-8" : "gap-3 sm:gap-5")}>
      {order.map((r) => (
        <div key={r.class_id} className={cx("flex flex-col items-center", tv ? "w-56" : "w-28 sm:w-36")}>
          <div className={tv ? "text-7xl" : "text-3xl sm:text-4xl"}>
            <Medal rank={r.rank} />
          </div>
          <div className={cx("font-display font-bold", tv ? "text-7xl" : "text-3xl sm:text-4xl", dark ? "text-white" : "text-leaf-900")}>{r.class_name}</div>
          <div className={cx("tabular mb-3 font-bold", tv ? "text-2xl" : "text-sm", dark ? "text-leaf-200" : "text-leaf-700")}>{pts(r.points)} pts</div>
          <div
            className={cx(
              "w-full rounded-t-3xl",
              heights[r.rank] ?? "h-20",
              r.rank === 1 ? "bg-sun-500" : r.rank === 2 ? "bg-leaf-300" : dark ? "bg-leaf-500" : "bg-leaf-200",
            )}
          />
        </div>
      ))}
    </div>
  );
}

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
    <ol className={tv ? "space-y-3" : "space-y-2"}>
      {shown.map((r) => (
        <li
          key={r.class_id}
          className={cx(
            "flex items-center",
            tv ? "gap-6 rounded-2xl px-6 py-4" : "gap-3 rounded-xl px-3 py-2.5",
            dark ? "bg-white/5" : "bg-white ring-1 ring-leaf-900/5",
            highlight === r.class_name && (dark ? "ring-2 ring-sun-300" : "ring-2 ring-sun-500"),
          )}
        >
          <span className={cx("text-center font-extrabold", tv ? "w-14 text-4xl" : "w-8 text-lg", dark ? "text-leaf-100" : "text-leaf-800")}>
            <Medal rank={r.rank} />
          </span>
          <span className={cx("font-display font-bold", tv ? "w-28 text-5xl" : "w-14 text-xl", dark ? "text-white" : "text-leaf-900")}>{r.class_name}</span>
          <span className={cx("relative flex-1 overflow-hidden rounded-full bg-leaf-900/10", tv ? "h-5 bg-white/10" : "h-3")}>
            <span
              className={cx("absolute inset-y-0 left-0 rounded-full", r.rank === 1 && r.points > 0 ? "bg-sun-500" : "bg-leaf-500")}
              style={{ width: `${Math.max(2, (r.points / max) * 100)}%` }}
            />
          </span>
          {!tv && (
            <span className={cx("tabular hidden w-20 text-right text-xs sm:inline", dark ? "text-leaf-200" : "text-stone-500")}>
              {r.days_submitted} day{r.days_submitted === 1 ? "" : "s"}
            </span>
          )}
          <span className={cx("tabular text-right font-extrabold", tv ? "w-36 text-5xl" : "w-20 text-lg", dark ? "text-white" : "text-leaf-900")}>
            {pts(r.points)}
          </span>
        </li>
      ))}
    </ol>
  );
}
