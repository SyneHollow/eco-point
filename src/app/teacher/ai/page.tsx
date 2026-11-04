import { ActionForm } from "@/components/client";
import { Badge, buttonClass, Card, cx, Empty, Field, inputClass, TeamTile } from "@/components/ui";
import { Icon } from "@/components/icons";
import { aiConfig } from "@/lib/ai";
import { addDays, fmtDay, isDate } from "@/lib/dates";
import { pts } from "@/lib/format";
import { requireTeacher } from "@/lib/session";
import { teacherAiChecks, teacherFlags, type AiCheckRow } from "@/lib/teacher-data";
import { reviewAiCheck, voidAiCheck } from "../ai-actions";

export const metadata = { title: "AI checks & flags" };

const LITTER = ["none", "a little", "noticeable", "messy"];
const FLAG_LABEL: Record<string, string> = { ai_mismatch: "Photo doesn't match", perfect_streak: "Too perfect?", generous_checker: "Generous checker" };

export default async function AiChecksPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const me = await requireTeacher();
  const sp = await searchParams;
  const to = isDate(sp.to) ? sp.to : me.today;
  const from = isDate(sp.from) && sp.from <= to ? sp.from : addDays(to, -13);
  const [checks, flags] = await Promise.all([teacherAiChecks(from, to), teacherFlags(from, to)]);
  const cfg = aiConfig();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl font-extrabold">AI checks &amp; flags</h1>
          <p className="mt-2 max-w-2xl text-stone-600">
            Every bin and room photo the AI checked, and anything that looks off. Photos are never stored, only the AI&apos;s counts. The AI can
            miscount, so a flag means &ldquo;have a look&rdquo;, not &ldquo;someone cheated&rdquo;.
          </p>
          <p className="mt-2 text-sm text-stone-500">
            AI service: {cfg.provider}, model {cfg.model}.
            {!cfg.ready && <span className="font-bold text-red-700"> Not set up: the API key is missing.</span>}
          </p>
        </div>
        <form className="flex flex-wrap items-end gap-2" method="get">
          <Field label="From">
            <input type="date" name="from" defaultValue={from} className={inputClass} />
          </Field>
          <Field label="To">
            <input type="date" name="to" defaultValue={to} className={inputClass} />
          </Field>
          <button className={buttonClass("secondary")}>Show</button>
        </form>
      </div>

      <Card title={`Things to look at (${flags.length})`}>
        {flags.length === 0 ? (
          <Empty>Nothing flagged in this period.</Empty>
        ) : (
          <ul className="space-y-2">
            {flags.map((f, i) => (
              <li key={i} className="flex flex-wrap items-start gap-3 rounded-[10px] border border-sun-500/50 bg-sun-100 px-4 py-3">
                <TeamTile name={f.class_name} size="xs" />
                <Badge tone="sun" icon="flag">{FLAG_LABEL[f.kind] ?? f.kind}</Badge>
                <span className="min-w-0 flex-1">
                  {f.flag_date && <span className="font-semibold text-sun-700">{fmtDay(f.flag_date)}: </span>}
                  {f.detail}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={`Photo checks (${checks.length})`}>
        {checks.length === 0 ? (
          <Empty>No AI photo checks in this period yet.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {checks.map((c) => (
              <CheckRow key={c.id} c={c} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function CheckRow({ c }: { c: AiCheckRow }) {
  const open = c.flagged && !c.reviewed && !c.voided;
  const counts = c.items.reduce<Record<string, number>>((m, it) => ((m[it.label] = (m[it.label] ?? 0) + 1), m), {});
  return (
    <li className={cx("grid gap-3 py-4 lg:grid-cols-[9rem_1fr_18rem]", c.voided && "opacity-50")}>
      <div>
        <TeamTile name={c.class_name} size="sm" />
        <div className="mt-1.5 text-sm text-stone-500">{fmtDay(c.check_date)}</div>
        <div className="mb-1.5 text-sm font-semibold">{c.check_type === "bin" ? "Bin check" : `Room check by ${c.checked_by}`}</div>
        {open && <Badge tone="sun" icon="flag">Needs a look</Badge>}
        {c.reviewed && <Badge icon="check">Reviewed</Badge>}
        {c.voided && <Badge tone="red">Voided</Badge>}
      </div>
      <div className="space-y-1.5">
        {c.check_type === "bin" ? (
          <p>
            <strong>{c.plastic_items}</strong> plastic item(s) for {c.present_used} students present
            {c.wrong_bin_items ? <>, {c.wrong_bin_items} in the wrong bin</> : null}.{" "}
            {c.baseline ? <Badge tone="sun">Measuring</Badge> : <strong>{pts(c.points)} pts</strong>}
          </p>
        ) : (
          <p>
            Lights <strong>{c.lights_on ? "on" : "off"}</strong>, litter: <strong>{LITTER[c.litter_level ?? 0]}</strong>
            {c.bin_overflowing ? ", bin overflowing" : ""}
          </p>
        )}
        {Object.keys(counts).length > 0 && (
          <p className="text-sm text-stone-500">
            Seen: {Object.entries(counts).map(([l, n]) => `${l}${n > 1 ? ` ×${n}` : ""}`).join(", ")}
          </p>
        )}
        {c.summary && <p className="border-l-4 border-lagoon-500 pl-3 text-sm text-stone-600"><span className="font-bold text-lagoon-700">The AI said: </span>{c.summary} (confidence {Math.round(c.confidence * 100)}%)</p>}
        {c.flag_reason && (
          <p className="flex items-start gap-1.5 font-semibold text-sun-700">
            <Icon name="flag" size={18} weight="fill" className="mt-0.5 shrink-0" />
            {c.flag_reason}
          </p>
        )}
        {c.review_note && <p className="text-sm text-leaf-600">Review note: {c.review_note}</p>}
        {c.void_reason && <p className="text-sm text-red-700">Voided: {c.void_reason}</p>}
      </div>
      <div className="space-y-2">
        {open && (
          <ActionForm action={reviewAiCheck} submitLabel="Reviewed: OK" variant="secondary" className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={c.id} />
            <input name="note" placeholder="Note (optional)" aria-label="Review note" className={cx(inputClass, "w-full")} />
          </ActionForm>
        )}
        {!c.voided && (
          <details>
            <summary className="inline-flex min-h-9 items-center rounded px-1 font-bold text-red-700 hover:underline">Void (allows a retake)</summary>
            <ActionForm action={voidAiCheck} submitLabel="Void it" variant="danger" className="mt-2 flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={c.id} />
              <input name="reason" required minLength={3} placeholder="Reason" aria-label="Reason for voiding" className={cx(inputClass, "w-full")} />
            </ActionForm>
          </details>
        )}
      </div>
    </li>
  );
}
