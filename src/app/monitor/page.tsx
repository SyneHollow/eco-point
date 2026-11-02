import Link from "next/link";
import { Banner, Card, Footer, Logo } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireMonitor } from "@/lib/session";
import { fmtDay, fmtLongDay, fmtTime } from "@/lib/dates";
import { pts } from "@/lib/format";
import { logout } from "../login/actions";
import { AuditForm, EntryForm } from "./forms";

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

export default async function MonitorPage() {
  const me = await requireMonitor();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_today");
  if (error || !data) throw new Error(error?.message ?? "Could not load today's check");
  const t = data as Today;
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

        {t.audit_target && t.peer_actions.length > 0 && (
          <Card title={`2 · Peer check: visit ${t.audit_target.name}`}>
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

        <Card title="3 · How your class did">
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
