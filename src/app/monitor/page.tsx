import Link from "next/link";
import { Banner, cx, teamColor } from "@/components/ui";
import { BadgeEmblem } from "@/components/badges";
import { GardenScene } from "@/components/garden-art";
import type { Garden } from "@/lib/rewards";
import { Icon } from "@/components/icons";
import { createClient } from "@/lib/supabase/server";
import { requireMonitor } from "@/lib/session";
import { fmtDay, fmtLongDay, fmtTime } from "@/lib/dates";
import { pts } from "@/lib/format";
import { AuditForm, EntryForm } from "./forms";
import { PhotoCheck } from "./photo-check";

export const dynamic = "force-dynamic";
export const metadata = { title: "Today's check" };

type Today = {
  today: string;
  class: { id: string; name: string; strength: number; active: boolean };
  school_name: string;
  baseline: boolean;
  points_start_date: string | null;
  self_actions: Array<{ code: string; label: string; help: string | null; input_type: "count" | "check"; max_points: number; sdgs: number[] }>;
  peer_actions: Array<{ code: string; label: string; help: string | null; max_points: number; sdgs: number[] }>;
  entry: { present: number; submitted_at: string; values: Record<string, number>; points: number; baseline: boolean } | null;
  audit_target: { id: string; name: string } | null;
  audit_done: { values: Record<string, number>; points: number; submitted_at: string } | null;
  checked_by: string | null;
  my_check_result: { values: Record<string, number>; points: number } | null;
  recent: Array<{ date: string; points: number }>;
};

type AiToday = {
  enabled: boolean;
  entry_submitted: boolean;
  audit_submitted: boolean;
  bin: { plastic_items: number; points: number; flagged: boolean; flag_reason: string | null; summary: string | null; baseline: boolean } | null;
  room: { class: string; lights_on: boolean; litter_level: number; flagged: boolean; flag_reason: string | null; summary: string | null } | null;
  challenge: string | null;
};

const LITTER = ["no litter", "a little litter", "noticeable litter", "messy"];

export default async function MonitorPage() {
  const me = await requireMonitor();
  const supabase = await createClient();
  const [{ data, error }, { data: aiData }] = await Promise.all([supabase.rpc("my_today"), supabase.rpc("my_ai_today")]);
  if (error || !data) throw new Error(error?.message ?? "Could not load today's check");
  const t = data as Today;
  const ai = (aiData ?? null) as AiToday | null;
  const peerLabel = Object.fromEntries(t.peer_actions.map((a) => [a.code, a.label]));
  const selfLabel = Object.fromEntries(t.self_actions.map((a) => [a.code, a]));

  const hasPeer = !!t.audit_target && t.peer_actions.length > 0;
  const jobs = [!!t.entry, ...(ai?.enabled ? [!!ai.bin] : []), ...(hasPeer ? [!!t.audit_done] : [])];
  const jobsDone = jobs.filter(Boolean).length;
  const recent = t.recent.slice(0, 7).reverse();
  const recentMax = Math.max(1, ...recent.map((r) => r.points));
  let n = 0;

  const { data: gardenData } = await supabase.rpc("my_garden");
  const garden = (gardenData ?? null) as Garden | null;

  return (
    <>
      <main className="mx-auto grid w-full max-w-6xl flex-1 items-start gap-6 px-4 py-6 lg:grid-cols-[minmax(0,42rem)_1fr]">
      <div className="space-y-5">
        <div className="rounded-xl border border-line bg-white px-5 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-xl font-bold">Today&apos;s jobs</h1>
            <span className="font-bold" role="status">
              {jobsDone === jobs.length ? "All done today" : `${jobsDone} of ${jobs.length} jobs done`}
            </span>
          </div>
          <div className="mt-3 flex gap-1.5" aria-hidden="true">
            {jobs.map((done, i) => (
              <span key={i} className={cx("h-2.5 flex-1 rounded-full", done ? "bg-leaf-600" : "bg-stone-100")} />
            ))}
          </div>
        </div>
        {t.baseline && t.points_start_date && (
          <Banner>
            Measuring week: count honestly. This is your class&apos;s &ldquo;before&rdquo; picture. Points start on {fmtLongDay(t.points_start_date)}.
          </Banner>
        )}

        {ai?.challenge && (
          <div className="flex items-start gap-3 rounded-xl border border-lagoon-500/40 bg-lagoon-100 px-4 py-3 text-lagoon-700">
            <Icon name="star" size={22} weight="fill" className="mt-0.5 shrink-0" />
            <div>
              <p className="font-bold">This week&apos;s challenge</p>
              <p className="text-lg font-semibold text-pitch">{ai.challenge}</p>
            </div>
          </div>
        )}

        <ol className="relative space-y-5 before:absolute before:top-5 before:bottom-5 before:left-[17px] before:w-0.5 before:bg-line">
          <Step n={++n} title="Today's class check" state={t.entry ? "done" : "todo"}>
            {t.entry ? (
              <div className="space-y-3">
                <DoneLine>Submitted at {fmtTime(t.entry.submitted_at, me.timezone)}</DoneLine>
                {!t.entry.baseline && <BigPoints value={pts(t.entry.points)} />}
                <ul className="divide-y divide-line border-y border-line">
                  <li className="flex justify-between gap-3 py-2.5">
                    <span>Students present</span>
                    <strong className="tabular">{t.entry.present}</strong>
                  </li>
                  {Object.entries(t.entry.values).map(([code, v]) => (
                    <li key={code} className="flex justify-between gap-3 py-2.5">
                      <span>{selfLabel[code]?.label ?? code}</span>
                      <strong className="tabular">{selfLabel[code]?.input_type === "check" ? (v ? "Yes" : "No") : `${v} of ${t.entry!.present}`}</strong>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-stone-500">Made a mistake? Ask your teacher to void it, then you can submit again.</p>
              </div>
            ) : !t.class.active ? (
              <p className="text-stone-600">Your class is switched off in EcoPoints. Ask your teacher.</p>
            ) : (
              <EntryForm actions={t.self_actions} strength={t.class.strength} />
            )}
          </Step>

          {ai?.enabled && (
            <Step n={++n} title="AI bin check (after lunch)" state={ai.bin ? "done" : t.entry ? "todo" : "locked"}>
              {t.entry || ai.bin ? (
                <PhotoCheck
                  kind="bin"
                  intro="Photograph the inside of your class bin from above. The AI counts single-use plastic, so your class's numbers are backed by evidence. Keep people out of the photo."
                  done={
                    ai.bin
                      ? {
                          line: `AI counted ${ai.bin.plastic_items} plastic item(s)${ai.bin.baseline ? " (measuring week)" : `, ${pts(ai.bin.points)} points`}`,
                          summary: ai.bin.summary,
                          flagged: ai.bin.flagged,
                          flag_reason: ai.bin.flag_reason,
                        }
                      : null
                  }
                />
              ) : (
                <p className="flex items-start gap-2 text-stone-600">
                  <Icon name="lock" size={18} className="mt-0.5 shrink-0" />
                  Submit today&apos;s class check first, then photograph the bin after lunch.
                </p>
              )}
            </Step>
          )}

          {hasPeer && t.audit_target && (
            <Step n={++n} title={`Peer check: visit ${t.audit_target.name}`} state={t.audit_done ? "done" : "todo"} target={t.audit_target.name}>
              {t.audit_done ? (
                <div className="space-y-3">
                  <DoneLine>
                    {t.audit_target.name} checked at {fmtTime(t.audit_done.submitted_at, me.timezone)}
                  </DoneLine>
                  <ul className="divide-y divide-line border-y border-line">
                    {Object.entries(t.audit_done.values).map(([code, v]) => (
                      <li key={code} className="flex justify-between gap-3 py-2.5">
                        <span>{peerLabel[code] ?? code}</span>
                        <YesNoText yes={!!v} />
                      </li>
                    ))}
                  </ul>
                  {ai?.enabled && (
                    <div className="pt-2">
                      <p className="mb-2 text-lg font-bold">Add a room photo as evidence</p>
                      <PhotoCheck
                        kind="room"
                        intro={`Photograph ${t.audit_target.name}'s empty room. The AI checks the lights and litter, so peer checks stay fair.`}
                        done={
                          ai.room
                            ? {
                                line: `Room photo checked: lights ${ai.room.lights_on ? "on" : "off"}, ${LITTER[ai.room.litter_level] ?? ""}`,
                                summary: ai.room.summary,
                                flagged: ai.room.flagged,
                                flag_reason: ai.room.flag_reason,
                              }
                            : null
                        }
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-stone-600">
                    Go to <strong className="text-pitch">{t.audit_target.name}</strong> and check honestly. Another class is checking yours today, so be fair.
                  </p>
                  <AuditForm actions={t.peer_actions} target={t.audit_target.name} />
                </div>
              )}
            </Step>
          )}

          <Step n={++n} title="How your class did" state="info">
            <div className="space-y-4">
              {t.checked_by &&
                (t.my_check_result ? (
                  <div>
                    <p>
                      <strong>{t.checked_by}</strong> checked your class today:
                    </p>
                    <ul className="mt-2 divide-y divide-line border-y border-line">
                      {Object.entries(t.my_check_result.values).map(([c, v]) => (
                        <li key={c} className="flex justify-between gap-3 py-2.5">
                          <span>{peerLabel[c] ?? c}</span>
                          <YesNoText yes={!!v} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p>
                    <strong>{t.checked_by}</strong> will check your class today.
                  </p>
                ))}
              {recent.length > 0 ? (
                <div>
                  <p className="mb-2 font-bold">Points, last {recent.length === 1 ? "day" : `${recent.length} days`}</p>
                  <ul className="flex h-40 items-end gap-1.5">
                    {recent.map((r) => (
                      <li key={r.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                        <span className="font-display tabular text-xl font-extrabold">{pts(r.points)}</span>
                        <span
                          className="mt-1 w-full rounded-t-md"
                          style={{ height: `${Math.max(4, (r.points / recentMax) * 64)}px`, background: teamColor(t.class.name) }}
                        />
                        <span className="mt-1 text-center text-xs leading-tight text-stone-500" title={fmtDay(r.date)}>
                          {fmtDay(r.date).split(" ")[0]}
                          <br />
                          {Number(r.date.slice(8, 10))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-stone-500">Your points will show here.</p>
              )}
              <Link href="/leaderboard" className="inline-flex min-h-11 items-center gap-2 rounded font-bold text-leaf-600 underline underline-offset-4 hover:text-pitch">
                <Icon name="ranking" size={20} />
                See where {t.class.name} ranks
              </Link>
            </div>
          </Step>
        </ol>
      </div>
      {garden && <SideRewards garden={garden} />}
      </main>
    </>
  );
}

/** Right-hand column on wide screens (below the steps on phones): badge progress and a peek at the garden. */
function SideRewards({ garden }: { garden: Garden }) {
  const b = garden.badges;
  const next = b.tiers.find((t) => !t.reached);
  const got = [...b.tiers].reverse().find((t) => t.reached);
  return (
    <aside className="space-y-5" aria-label="Rewards">
      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="text-lg font-bold">Badge this month</h2>
        <div className="mt-3 flex items-center gap-4">
          <BadgeEmblem code={(got ?? next ?? b.tiers[0]).code} earned={!!got} size={64} />
          <div className="min-w-0 flex-1">
            <p className="font-bold">{got ? got.name : "No badge yet"}</p>
            <p className="text-stone-500">
              <span className="font-display tabular text-2xl font-extrabold text-pitch">{pts(b.points)}</span> points this month
            </p>
          </div>
        </div>
        {next && (
          <div className="mt-3">
            <div className="h-2.5 overflow-hidden rounded-full bg-stone-100" aria-hidden="true">
              <div className="h-full rounded-full bg-sun-500" style={{ width: `${Math.min(100, (b.points / next.threshold) * 100)}%` }} />
            </div>
            <p className="mt-1.5 text-sm text-stone-600">
              {Math.ceil(next.threshold - b.points)} more for <strong>{next.name}</strong>
              {next.reward_name ? `, which wins a ${next.reward_name}` : ""}.
            </p>
          </div>
        )}
      </section>
      <Link href="/monitor/garden" className="group block overflow-hidden rounded-xl border border-line bg-white transition-colors hover:border-pitch">
        <GardenScene uid="peek" plants={garden.plants} className="block w-full" label={`Class ${garden.class.name}'s garden`} />
        <span className="flex items-center justify-between gap-3 px-5 py-3">
          <span>
            <span className="block font-bold group-hover:underline group-hover:underline-offset-4">Your class garden</span>
            <span className="text-stone-500">{pts(garden.available)} garden points to spend</span>
          </span>
          <Icon name="plant" size={24} className="text-leaf-600" />
        </span>
      </Link>
    </aside>
  );
}

/** One job in the day's sequence: a numbered marker on the timeline, then a white panel. */
function Step({
  n,
  title,
  state,
  children,
}: {
  n: number;
  title: string;
  state: "done" | "todo" | "locked" | "info";
  target?: string;
  children: React.ReactNode;
}) {
  const marker = {
    done: "bg-leaf-600 text-white",
    todo: "bg-pitch text-white ring-4 ring-sun-500/60",
    locked: "border-2 border-stone-300 bg-chalk text-stone-500",
    info: "border-2 border-stone-300 bg-white text-pitch",
  }[state];
  return (
    <li className="relative pl-12">
      <span
        className={cx("font-display absolute top-3.5 left-0 flex h-9 w-9 items-center justify-center rounded-full text-xl font-black", marker)}
        aria-hidden="true"
      >
        {state === "done" ? <Icon name="check" size={20} /> : n}
      </span>
      <section className={cx("rounded-xl border bg-white", state === "todo" ? "border-pitch/40" : "border-line")}>
        <h2 className="px-5 pt-4 text-xl leading-snug font-bold">
          <span className="sr-only">{state === "info" ? "" : `Step ${n}${state === "done" ? ", done" : state === "locked" ? ", not yet" : ""}: `}</span>
          {title}
        </h2>
        <div className="p-5 pt-3">{children}</div>
      </section>
    </li>
  );
}

function DoneLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 font-bold text-leaf-600">
      <Icon name="done" size={22} weight="fill" />
      <span>{children}</span>
    </p>
  );
}

function BigPoints({ value }: { value: string }) {
  return (
    <p className="font-display tabular text-6xl font-black">
      {value} <span className="text-3xl font-extrabold">points</span>
    </p>
  );
}

function YesNoText({ yes }: { yes: boolean }) {
  return (
    <strong className={cx("inline-flex items-center gap-1", yes ? "text-leaf-600" : "text-red-700")}>
      <Icon name={yes ? "check" : "x"} size={16} />
      {yes ? "Yes" : "No"}
    </strong>
  );
}
