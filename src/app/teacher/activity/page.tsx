import { ActionForm } from "@/components/client";
import { Badge, buttonClass, Card, cx, Empty, Field, inputClass } from "@/components/ui";
import { Icon } from "@/components/icons";
import { addDays, fmtDay, fmtTime, isDate } from "@/lib/dates";
import { pts } from "@/lib/format";
import { requireTeacher } from "@/lib/session";
import { teacherActions, teacherAudits, teacherEntries } from "@/lib/teacher-data";
import { voidEntry } from "../actions";

export const metadata = { title: "Daily records" };

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const me = await requireTeacher();
  const sp = await searchParams;
  const to = isDate(sp.to) ? sp.to : me.today;
  const from = isDate(sp.from) && sp.from <= to ? sp.from : addDays(to, -6);
  const [entries, audits, actions] = await Promise.all([teacherEntries(from, to), teacherAudits(from, to), teacherActions()]);
  // Show items in use, plus any switched-off item that still has answers in this period.
  const used = (code: string) => entries.some((e) => code in e.vals) || audits.some((a) => code in a.vals);
  const selfCols = actions.filter((a) => a.entered_by === "self" && (a.active || used(a.code)));
  const peerCols = actions.filter((a) => a.entered_by === "peer" && (a.active || used(a.code)));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl font-extrabold">Daily records</h1>
          <p className="mt-2 max-w-2xl text-stone-600">Every class check and peer check. Records can&apos;t be edited; void a wrong one and its points are reversed.</p>
        </div>
        <form className="flex flex-wrap items-end gap-2" method="get">
          <Field label="From">
            <input type="date" name="from" defaultValue={from} className={inputClass} />
          </Field>
          <Field label="To">
            <input type="date" name="to" defaultValue={to} className={inputClass} />
          </Field>
          <button className={buttonClass("secondary")}>Show</button>
          <a href={`/api/export?from=${from}&to=${to}`} className={buttonClass("primary")}>
            <Icon name="records" size={18} />
            Download CSV
          </a>
        </form>
      </div>

      <Card title={`Class checks (${entries.length})`}>
        {entries.length === 0 ? (
          <Empty>No class checks in this period.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-sm text-stone-500 [&_th]:font-semibold">
                <tr>
                  <th className="py-2 pr-3">Date</th>
                  <th className="pr-3">Class</th>
                  <th className="pr-3">Present</th>
                  {selfCols.map((a) => (
                    <th key={a.code} className="pr-3">{a.label}</th>
                  ))}
                  <th className="pr-3">Points</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {entries.map((e) => (
                  <tr key={e.id} className={cx(e.voided && "text-stone-400 [&>td:not(:last-child)]:line-through")}>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {fmtDay(e.entry_date)} <span className="text-stone-500">{fmtTime(e.submitted_at, me.timezone)}</span>
                    </td>
                    <td className="pr-3 font-bold">{e.class_name}</td>
                    <td className="tabular pr-3">{e.present}</td>
                    {selfCols.map((a) => (
                      <td key={a.code} className="tabular pr-3">
                        {e.vals[a.code] === undefined ? "–" : a.input_type === "check" ? (e.vals[a.code] ? "Yes" : "No") : `${e.vals[a.code]} (${Math.round((100 * e.vals[a.code]) / e.present)}%)`}
                      </td>
                    ))}
                    <td className="tabular pr-3 font-bold">{e.baseline ? <Badge tone="sun">baseline</Badge> : pts(e.points)}</td>
                    <td>
                      {e.voided ? (
                        <span className="text-red-700">Voided: {e.void_reason}</span>
                      ) : (
                        <VoidForm id={e.id} kind="entry" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={`Peer checks (${audits.length})`}>
        {audits.length === 0 ? (
          <Empty>No peer checks in this period.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-sm text-stone-500 [&_th]:font-semibold">
                <tr>
                  <th className="py-2 pr-3">Date</th>
                  <th className="pr-3">Class checked</th>
                  <th className="pr-3">Checked by</th>
                  {peerCols.map((a) => (
                    <th key={a.code} className="pr-3">{a.label}</th>
                  ))}
                  <th className="pr-3">Points</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {audits.map((a) => (
                  <tr key={a.id} className={cx(a.voided && "text-stone-400 [&>td:not(:last-child)]:line-through")}>
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtDay(a.audit_date)}</td>
                    <td className="pr-3 font-bold">{a.target_name}</td>
                    <td className="pr-3">{a.auditor_name}</td>
                    {peerCols.map((c) => (
                      <td key={c.code} className="pr-3">{a.vals[c.code] === undefined ? "–" : a.vals[c.code] ? "Yes" : "No"}</td>
                    ))}
                    <td className="tabular pr-3 font-bold">{a.baseline ? <Badge tone="sun">baseline</Badge> : pts(a.points)}</td>
                    <td>{a.voided ? <span className="text-red-700">Voided: {a.void_reason}</span> : <VoidForm id={a.id} kind="audit" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function VoidForm({ id, kind }: { id: string; kind: "entry" | "audit" }) {
  return (
    <details>
      <summary className="inline-flex min-h-9 items-center rounded px-1 font-bold text-red-700 hover:underline">Void</summary>
      <ActionForm action={voidEntry} submitLabel="Void it" variant="danger" className="mt-2 flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="kind" value={kind} />
        <input name="reason" required minLength={3} placeholder="Reason" aria-label="Reason for voiding" className={cx(inputClass, "w-48")} />
      </ActionForm>
    </details>
  );
}
