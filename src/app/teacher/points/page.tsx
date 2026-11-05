import { ActionForm } from "@/components/client";
import { Badge, Card, cx, Empty, Field, inputClass, TeamTile } from "@/components/ui";
import { fmtDay, fmtStampDay, periodRange } from "@/lib/dates";
import { Icon } from "@/components/icons";
import { leaves, pts } from "@/lib/format";
import { requireTeacher } from "@/lib/session";
import { teacherClasses, teacherLeafGrants, teacherLedger } from "@/lib/teacher-data";
import { awardPoints } from "../actions";
import { giveLeaves } from "../rewards-actions";

export const metadata = { title: "Bonus points & leaves" };

const TONE: Record<string, "leaf" | "sun" | "red" | "grey"> = { bonus: "leaf", adjustment: "sun", reversal: "red" };

export default async function PointsPage() {
  const me = await requireTeacher();
  const month = periodRange("month", me.today);
  const [classes, ledger, grants] = await Promise.all([
    teacherClasses(),
    teacherLedger(month.from, month.to, ["bonus", "adjustment", "reversal"]),
    teacherLeafGrants(20),
  ]);
  const active = classes.filter((c) => c.active);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-5xl font-extrabold">Bonus points &amp; leaves</h1>
        <p className="mt-2 max-w-2xl text-stone-600">
          <strong>Points</strong> move a class up the leaderboard and towards its badge. <strong>Leaves</strong> only buy things in the class
          garden and never change the score. Everything here needs a reason, is shown with your name, and can&apos;t be deleted.
        </p>
      </div>

      <Card title="Add points">
        <p className="mb-3 text-stone-600">
          Use a <strong>bonus</strong> for eco drives and one-off activities. Use an <strong>adjustment</strong> (can be negative) to correct something.
        </p>
        <ActionForm action={awardPoints} submitLabel="Save" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <Field label="Class">
            <select name="class_id" required defaultValue="" className={inputClass}>
              <option value="" disabled>Choose a class</option>
              {active.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Type">
            <select name="kind" defaultValue="bonus" className={inputClass}>
              <option value="bonus">Bonus</option>
              <option value="adjustment">Adjustment</option>
            </select>
          </Field>
          <Field label="Points">
            <input name="points" type="number" step="0.5" min="-100" max="100" required className={inputClass} />
          </Field>
          <Field label="Reason">
            <input name="reason" required minLength={3} className={inputClass} />
          </Field>
        </ActionForm>
      </Card>

      <Card title="Give leaves">
        <p className="mb-3 flex items-start gap-2 text-stone-600">
          <Icon name="leaf" size={20} className="mt-0.5 shrink-0 text-leaf-500" />
          <span>
            For the class garden: a thank-you for an eco drive, helping out, or extra effort. Up to 500 at a time. A minus number takes leaves back
            if you made a mistake. The class sees it in its garden history.
          </span>
        </p>
        <ActionForm action={giveLeaves} submitLabel="Give leaves" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_9rem_2fr] lg:items-end">
          <Field label="Class">
            <select name="class_id" required defaultValue="" className={inputClass}>
              <option value="" disabled>Choose a class</option>
              {active.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Leaves">
            <input name="leaves" type="number" step="1" min="-500" max="500" required className={inputClass} />
          </Field>
          <Field label="Reason (the class sees it)">
            <input name="reason" required minLength={3} maxLength={200} className={inputClass} />
          </Field>
        </ActionForm>
        {grants.length > 0 && (
          <div className="mt-5 overflow-x-auto border-t border-line pt-4">
            <h3 className="mb-2 font-bold">Recently given</h3>
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-sm text-stone-500 [&_th]:font-semibold">
                <tr>
                  <th className="py-2">Date</th>
                  <th>Class</th>
                  <th>Leaves</th>
                  <th>Reason</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {grants.map((g) => (
                  <tr key={g.id}>
                    <td className="py-2.5 whitespace-nowrap">{fmtStampDay(g.granted_at, me.timezone)}</td>
                    <td><TeamTile name={g.class_name} size="xs" /></td>
                    <td className={cx("tabular font-bold whitespace-nowrap", g.leaves < 0 ? "text-red-700" : "text-leaf-700")}>
                      {g.leaves > 0 ? "+" : "-"}{leaves(Math.abs(g.leaves))}
                    </td>
                    <td>{g.reason}</td>
                    <td className="text-stone-500">{g.by_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="This month's bonuses, adjustments and reversals">
        {ledger.length === 0 ? (
          <Empty>Nothing yet this month.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-sm text-stone-500 [&_th]:font-semibold">
              <tr>
                <th className="py-2">Date</th>
                <th>Class</th>
                <th>Type</th>
                <th>Points</th>
                <th>Reason</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ledger.map((l) => (
                <tr key={l.id}>
                  <td className="py-2.5 whitespace-nowrap">{fmtDay(l.points_date)}</td>
                  <td><TeamTile name={l.class_name} size="xs" /></td>
                  <td><Badge tone={TONE[l.source] ?? "grey"}>{l.source[0].toUpperCase() + l.source.slice(1)}</Badge></td>
                  <td className={cx("tabular font-bold", l.points < 0 && "text-red-700")}>{l.points > 0 ? "+" : ""}{pts(l.points)}</td>
                  <td>{l.reason}</td>
                  <td className="text-stone-500">{l.created_by_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
