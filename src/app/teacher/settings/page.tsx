import { ActionForm } from "@/components/client";
import { Card, Field, inputClass } from "@/components/ui";
import { fmtDay, fmtTime } from "@/lib/dates";
import { requireTeacher } from "@/lib/session";
import { activityLog, teacherStaff } from "@/lib/teacher-data";
import { addTeacher, saveSettings } from "../actions";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const me = await requireTeacher();
  const [staff, log] = await Promise.all([teacherStaff(), activityLog(60)]);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold text-leaf-900">Settings</h1>

      <Card title="School">
        <ActionForm action={saveSettings} submitLabel="Save" resetOnSuccess={false} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="School name">
              <input name="name" defaultValue={me.school_name} required minLength={2} className={inputClass} />
            </Field>
            <Field
              label="Points start date"
              hint="Days before this are a measuring week: classes record their habits with no points, giving you an honest 'before' to compare with. Leave empty for points from day one."
            >
              <input name="points_start_date" type="date" defaultValue={me.points_start_date ?? ""} className={inputClass} />
            </Field>
          </div>
        </ActionForm>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Teachers">
          <ul className="mb-5 divide-y divide-stone-100 text-sm">
            {staff.map((t) => (
              <li key={t.id} className="flex justify-between gap-3 py-2">
                <span className="font-bold">{t.display_name}</span>
                <span className="text-stone-500">{t.email}</span>
              </li>
            ))}
          </ul>
          <ActionForm action={addTeacher} submitLabel="Add teacher" className="space-y-3">
            <Field label="Name">
              <input name="display_name" required className={inputClass} />
            </Field>
            <Field label="Email">
              <input name="email" type="email" required className={inputClass} />
            </Field>
            <Field label="Temporary password" hint="At least 10 characters. Share it with them privately.">
              <input name="password" type="text" minLength={10} required autoComplete="off" className={inputClass} />
            </Field>
          </ActionForm>
        </Card>

        <Card title="Recent activity">
          <ul className="max-h-[28rem] space-y-2 overflow-y-auto text-sm">
            {log.map((l, i) => (
              <li key={i} className="rounded-lg bg-paper px-3 py-2">
                <div className="flex justify-between gap-2 text-xs text-stone-500">
                  <span>{l.actor_name ?? "System"}</span>
                  <span>
                    {fmtDay(l.at.slice(0, 10))} {fmtTime(l.at, me.timezone)}
                  </span>
                </div>
                <div className="font-semibold text-leaf-900">{describe(l.action, l.details)}</div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function describe(action: string, d: Record<string, unknown>) {
  const s = (k: string) => String(d?.[k] ?? "");
  switch (action) {
    case "entry.submit":
      return `${s("class")} submitted its class check${d?.baseline ? " (measuring)" : `: ${s("points")} pts`}`;
    case "audit.submit":
      return `Peer check of ${s("target")}${d?.baseline ? " (measuring)" : `: ${s("points")} pts`}`;
    case "points.bonus":
      return `Bonus ${s("points")} to ${s("class")}: ${s("reason")}`;
    case "points.adjustment":
      return `Adjustment ${s("points")} to ${s("class")}: ${s("reason")}`;
    case "entry.void":
    case "audit.void":
      return `Voided a ${action.startsWith("entry") ? "class check" : "peer check"} from ${s("date")}: ${s("reason")}`;
    case "month.close":
      return `Closed the month. Champion ${s("champion")} (${s("points")} pts)`;
    case "monitor.pin_set":
      return `Set the PIN for ${s("class")}`;
    case "account.link":
      return `Created a ${s("role")} login: ${s("display_name")}`;
    default:
      return action.replace(".", " ");
  }
}
