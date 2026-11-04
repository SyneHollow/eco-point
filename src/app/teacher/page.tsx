import Link from "next/link";
import { TrendChart } from "@/components/charts";
import { ActionForm } from "@/components/client";
import { LeaderList } from "@/components/leaderboard";
import { Badge, Banner, ButtonLink, Card, Field, inputClass, PageTitle, TeamTile } from "@/components/ui";
import { Icon } from "@/components/icons";
import { addDays, fmtLongDay, periodRange } from "@/lib/dates";
import { pts } from "@/lib/format";
import { getLeaderboard } from "@/lib/public-data";
import { requireTeacher } from "@/lib/session";
import { series, teacherFlags, teacherToday } from "@/lib/teacher-data";
import { awardPoints } from "./actions";

export const metadata = { title: "Teacher dashboard" };

export default async function TeacherDashboard() {
  const me = await requireTeacher();
  const month = periodRange("month", me.today);
  const [today, board, trend, flags] = await Promise.all([
    teacherToday(),
    getLeaderboard(month.from, month.to),
    series(addDays(me.today, -29), me.today),
    teacherFlags(addDays(me.today, -13), me.today),
  ]);
  const submitted = today.filter((c) => c.entry_submitted).length;
  const checked = today.filter((c) => c.checked).length;
  const noPin = today.filter((c) => !c.has_monitor).length;

  const total = today.length || 1;

  return (
    <div className="space-y-6">
      <PageTitle
        title="Today"
        sub={fmtLongDay(me.today)}
        actions={
          <>
            <ButtonLink href="/display" variant="secondary" icon="tv">Corridor screen</ButtonLink>
            <ButtonLink href="/leaderboard" variant="secondary" icon="ranking">Leaderboard</ButtonLink>
          </>
        }
      />

      {me.baseline && me.points_start_date && (
        <Banner>Measuring week is on: entries are recorded without points until {fmtLongDay(me.points_start_date)}. Change this in Settings.</Banner>
      )}
      {flags.length > 0 && (
        <Banner tone="flag">
          {flags.length} thing{flags.length === 1 ? "" : "s"} flagged by the AI referee in the last two weeks.{" "}
          <Link href="/teacher/ai" className="underline underline-offset-4">Review the flags</Link>
        </Banner>
      )}
      {noPin > 0 && (
        <Banner tone="lagoon" icon="key">
          {noPin} class{noPin === 1 ? " has" : "es have"} no login PIN yet. <Link href="/teacher/classes" className="underline underline-offset-4">Set PINs</Link>
        </Banner>
      )}

      <section aria-label="Today in numbers" className="grid divide-y divide-line rounded-xl border border-line bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Stat label="Class checks submitted" value={`${submitted} of ${today.length}`} progress={submitted / total} />
        <Stat label="Peer checks done" value={`${checked} of ${today.length}`} progress={checked / total} />
        <Stat label="Points this month, all classes" value={pts(board.reduce((s, r) => s + r.points, 0))} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card title="Today, class by class">
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full">
              <thead className="text-left text-sm text-stone-500">
                <tr className="border-b border-line">
                  <th className="pb-2 font-semibold">Class</th>
                  <th className="pb-2 font-semibold">Class check</th>
                  <th className="pb-2 font-semibold">Checked by</th>
                  <th className="pb-2 font-semibold">They check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {today.map((c) => (
                  <tr key={c.class_id}>
                    <td className="py-2.5 pr-3">
                      <TeamTile name={c.class_name} size="xs" />
                    </td>
                    <td className="pr-3">
                      {c.entry_submitted ? (
                        <Badge icon="check">
                          {c.present} present, {pts(c.entry_points)} pts
                        </Badge>
                      ) : (
                        <Badge tone={c.has_monitor ? "grey" : "red"} icon={c.has_monitor ? "clock" : "key"}>
                          {c.has_monitor ? "Not yet" : "No PIN"}
                        </Badge>
                      )}
                    </td>
                    <td className="pr-3">
                      {c.checked_by ? (
                        <span className={c.checked ? "inline-flex items-center gap-1 font-bold text-leaf-600" : "font-semibold text-stone-500"}>
                          {c.checked_by}
                          {c.checked ? <Icon name="check" size={16} label="checked" /> : <span className="sr-only">(not yet)</span>}
                        </span>
                      ) : (
                        <span className="text-stone-400">None</span>
                      )}
                    </td>
                    <td className="text-stone-600">{c.checks_class ?? <span className="text-stone-400">None</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          title="This month"
          action={
            <Link href="/leaderboard" className="rounded font-bold text-leaf-600 underline-offset-4 hover:underline">
              Full leaderboard
            </Link>
          }
        >
          <LeaderList rows={board} limit={8} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card title="Last 30 days, whole school (% each day)">
          <TrendChart rows={trend} />
        </Card>
        <Card title="Give bonus points">
          <ActionForm action={awardPoints} submitLabel="Award bonus" className="space-y-4">
            <input type="hidden" name="kind" value="bonus" />
            <Field label="Class">
              <select name="class_id" required defaultValue="" className={inputClass}>
                <option value="" disabled>Choose a class</option>
                {today.map((c) => (
                  <option key={c.class_id} value={c.class_id}>{c.class_name}</option>
                ))}
              </select>
            </Field>
            <Field label="Points">
              <input name="points" type="number" min="0.5" max="100" step="0.5" required className={inputClass} />
            </Field>
            <Field label="Reason" hint="For example: eco drive participation, paper-free week">
              <input name="reason" required minLength={3} className={inputClass} />
            </Field>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, progress }: { label: string; value: string; progress?: number }) {
  return (
    <div className="px-5 py-4">
      <div className="font-display tabular text-5xl font-extrabold">{value}</div>
      <div className="mt-1 font-semibold text-stone-500">{label}</div>
      {progress !== undefined && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100" aria-hidden="true">
          <div className="h-full rounded-full bg-leaf-600" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
    </div>
  );
}
