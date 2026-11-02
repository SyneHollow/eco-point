import Link from "next/link";
import { TrendChart } from "@/components/charts";
import { ActionForm } from "@/components/client";
import { LeaderList } from "@/components/leaderboard";
import { Badge, Banner, ButtonLink, Card, cx, Field, inputClass } from "@/components/ui";
import { addDays, fmtLongDay, periodRange } from "@/lib/dates";
import { pts } from "@/lib/format";
import { getLeaderboard } from "@/lib/public-data";
import { requireTeacher } from "@/lib/session";
import { series, teacherToday } from "@/lib/teacher-data";
import { awardPoints } from "./actions";

export const metadata = { title: "Teacher dashboard" };

export default async function TeacherDashboard() {
  const me = await requireTeacher();
  const month = periodRange("month", me.today);
  const [today, board, trend] = await Promise.all([teacherToday(), getLeaderboard(month.from, month.to), series(addDays(me.today, -29), me.today)]);
  const submitted = today.filter((c) => c.entry_submitted).length;
  const checked = today.filter((c) => c.checked).length;
  const noPin = today.filter((c) => !c.has_monitor).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-leaf-900">Today</h1>
          <p className="text-sm text-stone-500">{fmtLongDay(me.today)}</p>
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/display" variant="secondary">Corridor screen</ButtonLink>
          <ButtonLink href="/leaderboard" variant="secondary">Leaderboard</ButtonLink>
        </div>
      </div>

      {me.baseline && me.points_start_date && (
        <Banner>Measuring week is on: entries are recorded without points until {fmtLongDay(me.points_start_date)}. Change this in Settings.</Banner>
      )}
      {noPin > 0 && (
        <Banner tone="lagoon">
          {noPin} class{noPin === 1 ? " has" : "es have"} no login PIN yet. <Link href="/teacher/classes" className="underline">Set PINs →</Link>
        </Banner>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Class checks submitted" value={`${submitted} / ${today.length}`} />
        <Stat label="Peer checks done" value={`${checked} / ${today.length}`} />
        <Stat label="Points this month (all classes)" value={pts(board.reduce((s, r) => s + r.points, 0))} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card title="Today, class by class">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="py-2">Class</th>
                  <th>Class check</th>
                  <th>Checked by</th>
                  <th>They check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {today.map((c) => (
                  <tr key={c.class_id}>
                    <td className="py-2.5 font-display text-lg font-bold text-leaf-900">{c.class_name}</td>
                    <td>
                      {c.entry_submitted ? (
                        <Badge>✓ {c.present} present · {pts(c.entry_points)} pts</Badge>
                      ) : (
                        <Badge tone={c.has_monitor ? "grey" : "red"}>{c.has_monitor ? "Not yet" : "No PIN"}</Badge>
                      )}
                    </td>
                    <td>
                      <span className={cx("font-semibold", c.checked ? "text-leaf-700" : "text-stone-400")}>
                        {c.checked_by ?? "–"} {c.checked ? "✓" : ""}
                      </span>
                    </td>
                    <td className="text-stone-600">{c.checks_class ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="This month" action={<Link href="/leaderboard" className="text-sm font-bold text-leaf-700">Full →</Link>}>
          <LeaderList rows={board} limit={8} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card title="Last 30 days, whole school (% each day)">
          <TrendChart rows={trend} />
        </Card>
        <Card title="Give bonus points">
          <ActionForm action={awardPoints} submitLabel="Award bonus" className="space-y-3">
            <input type="hidden" name="kind" value="bonus" />
            <Field label="Class">
              <select name="class_id" required defaultValue="" className={inputClass}>
                <option value="" disabled>Choose…</option>
                {today.map((c) => (
                  <option key={c.class_id} value={c.class_id}>{c.class_name}</option>
                ))}
              </select>
            </Field>
            <Field label="Points">
              <input name="points" type="number" min="0.5" max="100" step="0.5" required className={inputClass} />
            </Field>
            <Field label="Reason" hint="e.g. Eco drive participation, paper-free week">
              <input name="reason" required minLength={3} className={inputClass} />
            </Field>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-leaf-900/5">
      <div className="text-xs font-bold uppercase tracking-wide text-stone-500">{label}</div>
      <div className="tabular font-display mt-1 text-3xl font-bold text-leaf-900">{value}</div>
    </div>
  );
}
