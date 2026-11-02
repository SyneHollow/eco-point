import { ActionForm } from "@/components/client";
import { Badge, Card, cx, Field, inputClass } from "@/components/ui";
import { requireTeacher } from "@/lib/session";
import { teacherClasses } from "@/lib/teacher-data";
import { saveClass, setMonitorPin } from "../actions";

export const metadata = { title: "Classes & PINs" };

export default async function ClassesPage() {
  await requireTeacher();
  const classes = await teacherClasses();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-leaf-900">Classes &amp; PINs</h1>
        <p className="max-w-2xl text-sm text-stone-600">
          Each class has one login, shared by its 2 Eco Monitors: they pick the class and type a 6-digit PIN. No student names or emails are stored.
          PINs are stored scrambled and can&apos;t be shown again, so write each one down when you set it.
        </p>
      </div>

      <Card>
        <div className="divide-y divide-stone-100">
          {classes.map((c) => (
            <div key={c.id} className={cx("grid gap-4 py-4 lg:grid-cols-[6rem_1fr_1fr] lg:items-end", !c.active && "opacity-60")}>
              <div>
                <div className="font-display text-2xl font-bold text-leaf-900">{c.name}</div>
                {c.monitor_user_id ? <Badge>PIN set</Badge> : <Badge tone="red">No PIN</Badge>}
              </div>
              <ActionForm action={saveClass} submitLabel="Save" variant="secondary" resetOnSuccess={false} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="grade" value={c.grade} />
                <input type="hidden" name="section" value={c.section} />
                <Field label="Students in class">
                  <input name="strength" type="number" min={1} max={80} defaultValue={c.strength} className={cx(inputClass, "w-28")} />
                </Field>
                <label className="mb-2.5 flex items-center gap-2 text-sm font-bold text-leaf-900">
                  <input type="checkbox" name="active" defaultChecked={c.active} className="h-4 w-4 accent-leaf-600" /> Taking part
                </label>
              </ActionForm>
              <ActionForm action={setMonitorPin} submitLabel={c.monitor_user_id ? "Reset PIN" : "Set PIN"} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="class_id" value={c.id} />
                <Field label={c.monitor_user_id ? "New PIN" : "PIN"}>
                  <input name="pin" inputMode="numeric" pattern="\d{6}" maxLength={6} required placeholder="6 digits" className={cx(inputClass, "tabular w-32 tracking-widest")} />
                </Field>
              </ActionForm>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Add a class">
        <ActionForm action={saveClass} submitLabel="Add class" className="flex flex-wrap items-end gap-3">
          <Field label="Grade">
            <input name="grade" type="number" min={1} max={12} required className={cx(inputClass, "w-24")} />
          </Field>
          <Field label="Section">
            <input name="section" required maxLength={2} placeholder="A" className={cx(inputClass, "w-24 uppercase")} />
          </Field>
          <Field label="Students">
            <input name="strength" type="number" min={1} max={80} required className={cx(inputClass, "w-28")} />
          </Field>
        </ActionForm>
      </Card>
    </div>
  );
}
