import { ActionForm } from "@/components/client";
import { Badge, Card, cx, Empty, Field, inputClass } from "@/components/ui";
import { fmtDay, periodRange } from "@/lib/dates";
import { pts } from "@/lib/format";
import { requireTeacher } from "@/lib/session";
import { teacherClasses, teacherLedger } from "@/lib/teacher-data";
import { awardPoints } from "../actions";

export const metadata = { title: "Bonus points" };

const TONE: Record<string, "leaf" | "sun" | "red" | "grey"> = { bonus: "leaf", adjustment: "sun", reversal: "red" };

export default async function PointsPage() {
  const me = await requireTeacher();
  const month = periodRange("month", me.today);
  const [classes, ledger] = await Promise.all([teacherClasses(), teacherLedger(month.from, month.to, ["bonus", "adjustment", "reversal"])]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-leaf-900">Bonus points</h1>
        <p className="max-w-2xl text-sm text-stone-600">
          Use a <strong>bonus</strong> for eco drives and one-off activities. Use an <strong>adjustment</strong> (can be negative) to correct something. Both need a reason, are shown with your name, and can&apos;t be deleted.
        </p>
      </div>

      <Card title="Add points">
        <ActionForm action={awardPoints} submitLabel="Save" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <Field label="Class">
            <select name="class_id" required defaultValue="" className={inputClass}>
              <option value="" disabled>Choose…</option>
              {classes.filter((c) => c.active).map((c) => (
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

      <Card title="This month's bonuses, adjustments and reversals">
        {ledger.length === 0 ? (
          <Empty>Nothing yet this month.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="py-2">Date</th>
                <th>Class</th>
                <th>Type</th>
                <th>Points</th>
                <th>Reason</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {ledger.map((l) => (
                <tr key={l.id}>
                  <td className="py-2">{fmtDay(l.points_date)}</td>
                  <td className="font-bold">{l.class_name}</td>
                  <td><Badge tone={TONE[l.source] ?? "grey"}>{l.source}</Badge></td>
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
