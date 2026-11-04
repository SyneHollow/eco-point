"use client";

import { useEffect, useState } from "react";
import { LeaderList, Podium } from "@/components/leaderboard";
import { cx } from "@/components/ui";
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
}: {
  monthLabel: string;
  monthRows: LeaderRow[];
  weekRows: LeaderRow[];
  impact: Impact | null;
  champion: Champion | null;
  ai: AiSummary | null;
  challenges: Array<{ class_id: string; class_name: string; text: string }>;
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
              <div key={it.code} className="rounded-3xl bg-white/5 p-8">
                <div className="font-display text-8xl font-bold text-sun-300">{pct(it.pct)}</div>
                <div className="mt-3 text-3xl font-bold">{it.label}</div>
                <div className="mt-2 text-xl text-leaf-200">
                  {it.input_type === "count" ? `${plural(it.total, "time")} this month` : `${num(it.total)} of ${plural(it.answers, "check")} passed`}
                </div>
              </div>
            ))}
          </div>
          {ai && ai.bin_checks > 0 && ai.per_10_students !== null && (
            <div className="mt-6 flex items-center gap-8 rounded-3xl bg-lagoon-700/40 p-8">
              <div className="font-display text-8xl font-bold text-sun-300">{ai.per_10_students}</div>
              <div>
                <div className="text-3xl font-bold">plastic items per 10 students in class bins</div>
                <div className="mt-2 text-xl text-leaf-200">Counted by the AI referee from {plural(ai.bin_checks, "bin photo")}. Lower is better!</div>
              </div>
            </div>
          )}
          <p className="mt-10 text-center text-3xl text-leaf-200">
            {plural(impact.eco_actions, "eco action")} logged from {plural(impact.entries, "class check")}
          </p>
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
              <div key={c.class_id} className="flex items-center gap-6 rounded-3xl bg-white/5 px-6 py-5">
                <span className="font-display w-24 text-5xl font-bold text-sun-300">{c.class_name}</span>
                <span className="text-2xl font-semibold">{c.text}</span>
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
        <Slide title="Green Champion">
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="text-8xl">🏆</div>
            <div className="font-display mt-4 text-[9rem] font-bold leading-none text-sun-300">{champion.class_name}</div>
            <div className="mt-4 text-3xl font-bold">
              {fmtMonth(champion.month)} · {pts(champion.points)} points
            </div>
          </div>
        </Slide>
      ),
    });
  }

  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), SLIDE_SECONDS * 1000);
    return () => clearInterval(t);
  }, [slides.length]);
  const current = slides[i % slides.length];

  return (
    <main className="flex flex-1 flex-col px-10 py-6">
      <div key={current.key} className="flex-1 animate-[fade_0.6s_ease]">
        {current.node}
      </div>
      <div className="mt-6 flex justify-center gap-2">
        {slides.map((s, n) => (
          <span key={s.key} className={cx("h-2 rounded-full transition-all", n === i % slides.length ? "w-10 bg-sun-300" : "w-2 bg-white/30")} />
        ))}
      </div>
      <style>{`@keyframes fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
    </main>
  );
}

function Slide({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h1 className="font-display mb-10 text-6xl font-bold">{title}</h1>
      {children}
    </section>
  );
}

function Big({ children }: { children: React.ReactNode }) {
  return <p className="py-16 text-center text-3xl font-bold text-leaf-200">{children}</p>;
}
