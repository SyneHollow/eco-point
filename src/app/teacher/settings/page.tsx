import { ActionForm } from "@/components/client";
import { Card, Field, inputClass } from "@/components/ui";
import { fmtDay, fmtTime } from "@/lib/dates";
import { requireTeacher } from "@/lib/session";
import { activityLog, teacherStaff } from "@/lib/teacher-data";
import { addTeacher, saveSettings } from "../actions";
import { saveAiSettings } from "../ai-actions";
import { aiConfig } from "@/lib/ai";
import { getSchool } from "@/lib/public-data";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const me = await requireTeacher();
  const [staff, log, school] = await Promise.all([teacherStaff(), activityLog(60), getSchool()]);
  const ai = { ai_enabled: school?.ai_enabled ?? true, ai_bin_max_points: school?.ai_bin_max_points ?? 10, ai_bin_zero_at: school?.ai_bin_zero_at ?? 0.5 };
  const cfg = aiConfig();

  return (
    <div className="space-y-6">
      <h1 className="font-display text-5xl font-extrabold">Settings</h1>

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

      <Card title="AI photo checks">
        <ActionForm action={saveAiSettings} submitLabel="Save AI settings" resetOnSuccess={false} className="space-y-4">
          <label className="flex min-h-11 items-center gap-2 font-bold">
            <input type="checkbox" name="enabled" defaultChecked={ai.ai_enabled} className="h-5 w-5 accent-leaf-600" /> AI bin and room photo checks are on
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Bin check: points for a plastic-free bin" hint="Points fall as the AI finds more plastic items.">
              <input name="bin_max_points" type="number" step="0.5" min="0.5" max="100" defaultValue={ai.ai_bin_max_points} className={inputClass} />
            </Field>
            <Field
              label="Bin check: zero points at … plastic items per student"
              hint="0.5 means a class of 30 scores nothing at 15 or more plastic items. Tune this during the measuring week."
            >
              <input name="bin_zero_at" type="number" step="0.05" min="0.05" max="5" defaultValue={ai.ai_bin_zero_at} className={inputClass} />
            </Field>
          </div>
          <p className="text-sm text-stone-500">
            AI service: {cfg.provider} ({cfg.model}), {cfg.ready ? "connected" : "API key missing"}. Photos are never stored; people in
            photos are rejected.
          </p>
        </ActionForm>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Teachers">
          <ul className="mb-5 divide-y divide-line">
            {staff.map((t) => (
              <li key={t.id} className="flex flex-wrap justify-between gap-x-3 py-2.5">
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
          <ul className="max-h-[28rem] divide-y divide-line overflow-y-auto">
            {log.map((l, i) => (
              <li key={i} className="py-2.5">
                <div className="flex justify-between gap-2 text-sm text-stone-500">
                  <span>{l.actor_name ?? "System"}</span>
                  <span>
                    {fmtDay(l.at.slice(0, 10))} {fmtTime(l.at, me.timezone)}
                  </span>
                </div>
                <div className="font-semibold">{describe(l.action, l.details)}</div>
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
    case "ai.bin":
      return `AI bin check for ${s("class")}: ${s("plastic_items")} plastic item(s)${d?.flagged ? " (flagged)" : ""}`;
    case "ai.room":
      return `AI room check of ${s("class")}${d?.flagged ? " (flagged)" : ""}`;
    case "ai.review":
      return "Reviewed an AI flag";
    case "ai.void":
      return `Voided an AI check: ${s("reason")}`;
    case "ai.attempt":
      return `Photo sent to the AI (${s("class")})`;
    case "ai.settings":
      return "Changed AI settings";
    case "challenges.publish":
      return `Published ${s("count")} weekly challenge(s)`;
    case "account.link":
      return `Created a ${s("role")} login: ${s("display_name")}`;
    default:
      return action.replace(".", " ");
  }
}
