"use client";

import { useEffect, useState } from "react";
import { LeaderList, Podium } from "@/components/leaderboard";
import { cx, TeamTile } from "@/components/ui";
import { BadgeEmblem } from "@/components/badges";
import { GardenScene } from "@/components/garden-art";
import type { BadgeRow, GardenPlot } from "@/lib/rewards";
import { Icon } from "@/components/icons";
import type { AiSummary, Champion, Impact, LeaderRow } from "@/lib/types";
import { fmtMonth } from "@/lib/dates";
import { num, pct, plural, pts } from "@/lib/format";

const SLIDE_SECONDS = 12;

export function DisplaySlides({
  monthLabel,
  monthRows,
  weekRows,
  impact,
  champion,
  ai,
  challenges,
  badges,
  gardens,
}: {
  monthLabel: string;
  monthRows: LeaderRow[];
  weekRows: LeaderRow[];
  impact: Impact | null;
  champion: Champion | null;
  ai: AiSummary | null;
  challenges: Array<{ class_id: string; class_name: string; text: string }>;
  badges: BadgeRow[];
  gardens: GardenPlot[];
}) {
  const slides: Array<{ key: string; node: React.ReactNode }> = [
    {
      key: "month",
      node: (
        <Slide title={`${monthLabel} leaderboard`}>
          <div className="grid items-end gap-12 lg:grid-cols-[5fr_6fr]">
            <div className="flex items-end justify-center">
              {monthRows.some((r) => r.points > 0) ? <Podium rows={monthRows} dark size="tv" /> : <Big>No points yet this month</Big>}
            </div>
            <LeaderList rows={monthRows} dark limit={8} size="tv" />
          </div>
        </Slide>
      ),
    },
    {
      key: "week",
      node: (
        <Slide title="This week">
          {weekRows.some((r) => r.points > 0) ? (
            <div className="mx-auto max-w-5xl">
              <LeaderList rows={weekRows} dark limit={8} size="tv" />
            </div>
          ) : (
            <Big>The week has just started. Make it count!</Big>
          )}
        </Slide>
      ),
    },
  ];
  if (impact && impact.entries > 0) {
    slides.push({
      key: "impact",
      node: (
        <Slide title={`Together in ${monthLabel}`}>
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {impact.items.map((it) => (
              <div key={it.code} className="rounded-2xl border border-white/10 bg-white/[0.05] p-8">
                <div className="font-display tabular text-[10rem] leading-none font-black">{pct(it.pct)}</div>
                <div className="mt-4 text-3xl font-bold">{it.label}</div>
                <div className="mt-2 text-xl text-leaf-200">
                  {it.input_type === "count" ? `${plural(it.total, "time")} this month` : `${num(it.total)} of ${plural(it.answers, "check")} passed`}
                </div>
              </div>
            ))}
          </div>
          {ai && ai.bin_checks > 0 && ai.per_10_students !== null && (
            <div className="mt-6 flex items-center gap-10 rounded-2xl bg-team-sky p-8 text-pitch">
              <Icon name="scan" size={88} />
              <div className="font-display tabular text-[10rem] leading-none font-black">{ai.per_10_students}</div>
              <div>
                <div className="text-3xl font-bold">plastic items per 10 students in class bins</div>
                <div className="mt-2 text-2xl">Counted by the AI referee from {plural(ai.bin_checks, "bin photo")}. Lower is better!</div>
              </div>
            </div>
          )}
          <p className="mt-10 text-3xl text-leaf-200">
            {plural(impact.eco_actions, "eco action")} logged from {plural(impact.entries, "class check")}
          </p>
        </Slide>
      ),
    });
  }
  if (badges.some((b) => b.tier_code)) {
    slides.push({
      key: "badges",
      node: (
        <Slide title={`${monthLabel} badges`}>
          <ul className="grid grid-cols-4 gap-6">
            {badges.slice(0, 8).map((b) => (
              <li key={b.class_id} className="flex items-center gap-5 rounded-2xl border border-white/10 bg-white/[0.05] p-5">
                <BadgeEmblem code={b.tier_code ?? "tiny_sprout"} earned={!!b.tier_code} size={110} />
                <div>
                  <TeamTile name={b.class_name} size="sm" />
                  <div className="mt-2 text-3xl leading-tight font-bold">{b.tier_name ?? "Not yet"}</div>
                  <div className="text-xl text-leaf-200">{b.next_threshold !== null ? `${Math.ceil(b.next_threshold - b.points)} to ${b.next_name}` : "Top badge!"}</div>
                </div>
              </li>
            ))}
          </ul>
        </Slide>
      ),
    });
  }
  if (gardens.length > 0) {
    const classes = [...new Map(monthRows.map((r) => [r.class_id, r.class_name])).entries()].sort((a, b) => a[1].localeCompare(b[1], "en", { numeric: true }));
    slides.push({
      key: "gardens",
      node: (
        <Slide title="Class gardens">
          <ul className="grid grid-cols-4 gap-6">
            {classes.slice(0, 8).map(([id, name]) => (
              <li key={id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05]">
                <GardenScene uid={`tv-${id}`} still plants={gardens.filter((g) => g.class_id === id).map((g) => ({ item: g.item_code, plot: g.plot, stage: g.stage }))}
                  className="block w-full" label={`Class ${name}'s garden`} />
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <TeamTile name={name} size="xs" />
                  <span className="text-xl font-bold">{gardens.filter((g) => g.class_id === id).length} plants</span>
                </div>
              </li>
            ))}
          </ul>
        </Slide>
      ),
    });
  }
  if (challenges.length > 0) {
    slides.push({
      key: "challenges",
      node: (
        <Slide title="This week's challenges">
          <div className="grid gap-4 lg:grid-cols-2">
            {challenges.map((c) => (
              <div key={c.class_id} className="flex items-center gap-6 rounded-2xl border border-white/10 bg-white/[0.05] px-6 py-5">
                <TeamTile name={c.class_name} size="tv" className="shrink-0" />
                <span className="text-3xl leading-snug font-semibold">{c.text}</span>
              </div>
            ))}
          </div>
        </Slide>
      ),
    });
  }
  if (champion?.class_name) {
    slides.push({
      key: "champion",
      node: (
        <Slide title="Last month's winner">
          <div className="flex items-center justify-center gap-16 py-10">
            <Icon name="trophy" size={300} weight="fill" className="text-sun-500" />
            <div>
              <TeamTile name={champion.class_name} className="h-60 min-w-72 px-10 text-[13rem]" />
              <div className="mt-6 text-4xl font-bold">Green Champion of {fmtMonth(champion.month)}</div>
              <div className="font-display tabular mt-2 text-7xl font-extrabold">{pts(champion.points)} points</div>
            </div>
          </div>
        </Slide>
      ),
    });
  }

  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), SLIDE_SECONDS * 1000);
    return () => clearInterval(t);
  }, [slides.length, paused]);
  const current = slides[i % slides.length];

  return (
    <main className="flex min-h-0 flex-1 flex-col px-12 pt-6 pb-4">
      <div key={current.key} className="slide-in min-h-0 flex-1">
        {current.node}
      </div>
      <div className="mt-4 flex shrink-0 items-center justify-center gap-3">
        {slides.map((s, n) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setI(n)}
            aria-label={`Show slide ${n + 1}`}
            aria-current={n === i % slides.length ? "true" : undefined}
            className={cx("h-2.5 rounded-full transition-[width,background-color]", n === i % slides.length ? "w-14 bg-sun-500" : "w-2.5 bg-white/30")}
          />
        ))}
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          className="ml-4 rounded-lg px-3 py-1 text-base font-bold text-leaf-200 hover:text-white"
        >
          {paused ? "Play" : "Pause"}
        </button>
      </div>
    </main>
  );
}

function Slide({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h1 className="font-display mb-8 text-8xl font-black">{title}</h1>
      {children}
    </section>
  );
}

function Big({ children }: { children: React.ReactNode }) {
  return <p className="py-16 text-center text-4xl font-bold text-leaf-200">{children}</p>;
}
