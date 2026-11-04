import { ActionForm } from "@/components/client";
import { Badge, Card, cx, Field, inputClass } from "@/components/ui";
import { pts } from "@/lib/format";
import { requireTeacher } from "@/lib/session";
import { teacherActions } from "@/lib/teacher-data";
import { saveAction } from "../actions";

export const metadata = { title: "Checklist" };

export default async function CriteriaPage() {
  await requireTeacher();
  const actions = await teacherActions();
  const dailyMax = actions.filter((a) => a.active).reduce((s, a) => s + Number(a.max_points), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-5xl font-extrabold">Daily checklist</h1>
        <p className="mt-2 max-w-2xl text-stone-600">
          What classes are scored on every day. Daily maximum now: <strong>{pts(dailyMax)} points</strong> per class. Changes apply from the next
          entry; points already earned don&apos;t change. Counts are scored as a share of students present, so class size doesn&apos;t matter.
        </p>
      </div>

      <div className="space-y-4">
        {actions.map((a) => (
          <Card key={a.id} className={cx(!a.active && "opacity-70")}>
            <ActionForm action={saveAction} submitLabel="Save" variant="secondary" resetOnSuccess={false} className="space-y-3">
              <input type="hidden" name="id" value={a.id} />
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={a.input_type === "count" ? "leaf" : "lagoon"}>{a.input_type === "count" ? "Count of students" : "Yes / no"}</Badge>
                <Badge tone="grey">{a.entered_by === "self" ? "Entered by the class" : "Peer check by another class"}</Badge>
                <code className="text-sm text-stone-500">{a.code}</code>
              </div>
              <div className="grid gap-3 md:grid-cols-[2fr_3fr_7rem_8rem_6rem]">
                <Field label="Name">
                  <input name="label" defaultValue={a.label} required className={inputClass} />
                </Field>
                <Field label="Help text for monitors">
                  <input name="help" defaultValue={a.help ?? ""} className={inputClass} />
                </Field>
                <Field label="Max points">
                  <input name="max_points" type="number" step="0.5" min="0.5" max="100" defaultValue={a.max_points} required className={inputClass} />
                </Field>
                <Field label="SDGs">
                  <input name="sdgs" defaultValue={a.sdgs.join(", ")} placeholder="12, 13" className={inputClass} />
                </Field>
                <Field label="Order">
                  <input name="sort_order" type="number" defaultValue={a.sort_order} className={inputClass} />
                </Field>
              </div>
              <label className="flex min-h-11 items-center gap-2 font-bold">
                <input type="checkbox" name="active" defaultChecked={a.active} className="h-5 w-5 accent-leaf-600" /> In use
              </label>
            </ActionForm>
          </Card>
        ))}
      </div>

      <Card title="Add an item">
        <ActionForm action={saveAction} submitLabel="Add item" className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Name">
              <input name="label" required className={inputClass} placeholder="For example: fans off at break" />
            </Field>
            <Field label="Short code" hint="lowercase letters, numbers, _ (can't change later)">
              <input name="code" required pattern="[a-z0-9_]{2,40}" className={inputClass} placeholder="fans_off" />
            </Field>
            <Field label="Help text for monitors">
              <input name="help" className={inputClass} />
            </Field>
            <Field label="Type">
              <select name="input_type" defaultValue="check" className={inputClass}>
                <option value="check">Yes / no</option>
                <option value="count">Count of students</option>
              </select>
            </Field>
            <Field label="Who answers" hint="Counts must be entered by the class itself">
              <select name="entered_by" defaultValue="peer" className={inputClass}>
                <option value="peer">Peer check by another class</option>
                <option value="self">The class itself</option>
              </select>
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Max points">
                <input name="max_points" type="number" step="0.5" min="0.5" max="100" required className={inputClass} />
              </Field>
              <Field label="SDGs">
                <input name="sdgs" className={inputClass} placeholder="12" />
              </Field>
              <Field label="Order">
                <input name="sort_order" type="number" defaultValue={100} className={inputClass} />
              </Field>
            </div>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
