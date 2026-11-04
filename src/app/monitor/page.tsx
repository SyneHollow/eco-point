import Link from "next/link";
import { Banner, Card, Footer, Logo } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireMonitor } from "@/lib/session";
import { fmtDay, fmtLongDay, fmtTime } from "@/lib/dates";
import { pts } from "@/lib/format";
import { logout } from "../login/actions";
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

  return (
    <>
      <header className="bg-leaf-800 text-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-4">
          <Link href="/">
            <Logo dark />
          </Link>
          <form action={logout}>
            <button className="rounded-lg px-3 py-2 text-sm font-bold text-leaf-100 hover:bg-white/10">Log out</button>
          </form>
        </div>
        <div className="mx-auto max-w-2xl px-4 pb-6">
          <p className="text-sm font-bold text-leaf-200">{fmtLongDay(t.today)}</p>
          <h1 className="font-display text-4xl font-bold">Class {t.class.name}</h1>
          <p className="text-leaf-100">{me.display_name}</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-5 px-4 py-6">
        {t.baseline && t.points_start_date && (
          <Banner>
            Measuring week: count honestly. This is your class&apos;s &ldquo;before&rdquo; picture. Points start on {fmtLongDay(t.points_start_date)}.
          </Banner>
        )}

        {ai?.challenge && (
          <div className="rounded-2xl bg-lagoon-100 px-4 py-3 text-lagoon-700 ring-1 ring-lagoon-500/30">
            <p className="text-xs font-extrabold uppercase tracking-wider">This week&apos;s challenge</p>
            <p className="font-display text-xl font-semibold">{ai.challenge}</p>
          </div>
        )}

        <Card title="1 · Today's class check">
          {t.entry ? (
            <div className="space-y-3">
              <p className="font-bold text-leaf-700">
                ✓ Submitted at {fmtTime(t.entry.submitted_at, me.timezone)}
                {!t.entry.baseline && <> · {pts(t.entry.points)} points</>}
              </p>
              <ul className="divide-y divide-stone-100 text-sm">
                <li className="flex justify-between py-2">
                  <span>Students present</span>
                  <strong>{t.entry.present}</strong>
                </li>
                {Object.entries(t.entry.values).map(([code, v]) => (
                  <li key={code} className="flex justify-between py-2">
                    <span>{selfLabel[code]?.label ?? code}</span>
                    <strong>{selfLabel[code]?.input_type === "check" ? (v ? "Yes" : "No") : `${v} of ${t.entry!.present}`}</strong>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-stone-500">Made a mistake? Ask your teacher to void it, then you can submit again.</p>
            </div>
          ) : !t.class.active ? (
            <p className="text-stone-600">Your class is switched off in EcoPoints. Ask your teacher.</p>
          ) : (
            <EntryForm actions={t.self_actions} strength={t.class.strength} />
          )}
        </Card>

        {ai?.enabled && (
          <Card title="2 · AI bin check (after lunch)">
            {t.entry || ai.bin ? (
              <PhotoCheck
                kind="bin"
                intro="Photograph the inside of your class bin from above. The AI counts single-use plastic, so your class's numbers are backed by evidence. Keep people out of the photo."
                done={
                  ai.bin
                    ? {
                        line: `AI counted ${ai.bin.plastic_items} plastic item(s)${ai.bin.baseline ? " (measuring week)" : ` · ${pts(ai.bin.points)} points`}`,
                        summary: ai.bin.summary,
                        flagged: ai.bin.flagged,
                        flag_reason: ai.bin.flag_reason,
                      }
                    : null
                }
              />
            ) : (
              <p className="text-sm text-stone-600">Submit today&apos;s class check first, then photograph the bin after lunch.</p>
            )}
          </Card>
        )}

        {t.audit_target && t.peer_actions.length > 0 && (
          <Card title={`3 · Peer check: visit ${t.audit_target.name}`}>
            {t.audit_done ? (
              <div className="space-y-2 text-sm">
                <p className="font-bold text-leaf-700">✓ {t.audit_target.name} checked at {fmtTime(t.audit_done.submitted_at, me.timezone)}</p>
                <ul className="divide-y divide-stone-100">
                  {Object.entries(t.audit_done.values).map(([code, v]) => (
                    <li key={code} className="flex justify-between py-2">
                      <span>{peerLabel[code] ?? code}</span>
                      <strong>{v ? "Yes" : "No"}</strong>
                    </li>
                  ))}
                </ul>
                {ai?.enabled && (
                  <div className="mt-4 border-t border-stone-100 pt-4">
                    <p className="mb-2 font-extrabold text-leaf-900">Add a room photo as evidence</p>
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
                <p className="text-sm text-stone-600">
                  Go to <strong>{t.audit_target.name}</strong> and check honestly. Another class is checking yours today, so be fair.
                </p>
                <AuditForm actions={t.peer_actions} target={t.audit_target.name} />
              </div>
            )}
          </Card>
        )}

        <Card title="4 · How your class did">
          <div className="space-y-4 text-sm">
            <p>
              {t.checked_by ? (
                t.my_check_result ? (
                  <>
                    <strong>{t.checked_by}</strong> checked your class today:{" "}
                    {Object.entries(t.my_check_result.values)
                      .map(([c, v]) => `${peerLabel[c] ?? c} ${v ? "✓" : "✗"}`)
                      .join(" · ")}
                  </>
                ) : (
                  <>
                    <strong>{t.checked_by}</strong> will check your class today.
                  </>
                )
              ) : null}
            </p>
            {t.recent.length > 0 ? (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {t.recent.slice(0, 8).map((r) => (
                  <li key={r.date} className="rounded-xl bg-leaf-50 px-3 py-2">
                    <div className="text-xs font-bold text-stone-500">{fmtDay(r.date)}</div>
                    <div className="tabular text-lg font-extrabold text-leaf-800">{pts(r.points)}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-stone-500">Your points will show here.</p>
            )}
            <Link href="/leaderboard" className="inline-block font-bold text-leaf-700 hover:underline">
              See where {t.class.name} ranks →
            </Link>
          </div>
        </Card>
      </main>
      <Footer />
    </>
  );
}
