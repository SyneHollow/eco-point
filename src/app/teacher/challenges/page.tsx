import { ActionForm } from "@/components/client";
import { Badge, ButtonLink, Card, cx, Empty, Field, inputClass, PageTitle, TeamTile } from "@/components/ui";
import { addDays, fmtDay } from "@/lib/dates";
import { pts } from "@/lib/format";
import { requireTeacher } from "@/lib/session";
import { teacherChallengeClaims, teacherChallenges, type TeacherChallenge } from "@/lib/teacher-data";
import { REPEAT_LABEL } from "@/lib/rewards";
import { reviewClaim, saveChallenge, voidClaim } from "../rewards-actions";

export const metadata = { title: "Eco challenges" };

const STATUS: Record<string, { tone: "leaf" | "sun" | "red" | "grey"; label: string }> = {
  approved: { tone: "leaf", label: "Approved" },
  pending: { tone: "sun", label: "Waiting" },
  rejected: { tone: "grey", label: "Sent back" },
  voided: { tone: "red", label: "Voided" },
};

export default async function TeacherChallengesPage() {
  const me = await requireTeacher();
  const [challenges, claims] = await Promise.all([teacherChallenges(), teacherChallengeClaims(addDays(me.today, -13), me.today)]);
  const pending = claims.filter((c) => c.status === "pending");
  const recent = claims.filter((c) => c.status !== "pending");

  return (
    <div className="space-y-6">
      <PageTitle
        title="Eco challenges"
        sub="Extra points for real eco actions. Each challenge has a QR code: print it and put it where the challenge happens."
        actions={<ButtonLink href="/teacher/challenges/print" icon="qr">Print QR codes</ButtonLink>}
      />

      <Card title={`Waiting for you (${pending.length})`}>
        {pending.length === 0 ? (
          <Empty>No write-ups to check. Classes send them from their project challenges.</Empty>
        ) : (
          <ul className="space-y-4">
            {pending.map((c) => (
              <li key={c.id} className="rounded-xl border border-sun-500/50 bg-sun-100/60 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <TeamTile name={c.class_name} size="sm" />
                  <span className="font-bold">{c.challenge_title}</span>
                  <span className="text-stone-500">{fmtDay(c.claim_date)}</span>
                  <span className="ml-auto font-display tabular text-2xl font-black text-leaf-600">+{pts(c.points)}</span>
                </div>
                <blockquote className="mt-3 border-l-4 border-sun-500 bg-white px-4 py-3 whitespace-pre-line">{c.answer}</blockquote>
                <div className="mt-3 flex flex-wrap items-start gap-3">
                  <ActionForm action={reviewClaim} submitLabel="Approve" resetOnSuccess={false}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="approve" value="1" />
                  </ActionForm>
                  <details className="min-w-64 flex-1">
                    <summary className="inline-flex min-h-11 items-center rounded px-1 font-bold text-red-700 hover:underline">Send back</summary>
                    <ActionForm action={reviewClaim} submitLabel="Send back" variant="danger" className="mt-2 flex flex-wrap items-end gap-2">
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="approve" value="0" />
                      <input name="note" required minLength={3} maxLength={300} placeholder="What should they add or fix?" aria-label="Reason" className={cx(inputClass, "min-w-56 flex-1")} />
                    </ActionForm>
                  </details>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Done in the last two weeks">
        {recent.length === 0 ? (
          <Empty>Nothing yet.</Empty>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full">
              <thead className="border-b border-line text-left text-sm text-stone-500 [&_th]:font-semibold">
                <tr><th className="pb-2">Date</th><th className="pb-2">Class</th><th className="pb-2">Challenge</th><th className="pb-2">Status</th><th className="pb-2 text-right">Points</th><th className="pb-2" /></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recent.map((c) => (
                  <tr key={c.id} className="align-top">
                    <td className="py-2.5 pr-3 whitespace-nowrap">{fmtDay(c.claim_date)}</td>
                    <td className="py-2 pr-3"><TeamTile name={c.class_name} size="xs" /></td>
                    <td className="py-2.5 pr-3">
                      <span className="font-semibold">{c.challenge_title}</span>
                      {c.review_note && <span className="block text-sm text-stone-500">Note: {c.review_note}</span>}
                    </td>
                    <td className="py-2.5 pr-3"><Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge></td>
                    <td className="tabular py-2.5 pr-3 text-right font-bold">{c.status === "approved" ? `+${pts(c.points)}` : "–"}</td>
                    <td className="py-2">
                      {c.status === "approved" && (
                        <details>
                          <summary className="inline-flex min-h-9 items-center rounded px-1 font-bold text-red-700 hover:underline">Void</summary>
                          <ActionForm action={voidClaim} submitLabel="Void it" variant="danger" className="mt-2 flex flex-wrap items-center gap-2">
                            <input type="hidden" name="id" value={c.id} />
                            <input name="reason" required minLength={3} placeholder="Reason" aria-label="Reason for voiding" className={cx(inputClass, "w-48")} />
                          </ActionForm>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={`Challenges (${challenges.filter((c) => c.active).length} on)`}>
        <ul className="divide-y divide-line">
          {challenges.map((c) => (
            <li key={c.id} className={cx("py-4 first:pt-0", !c.active && "opacity-60")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-bold">{c.title}</p>
                  <p className="text-stone-600">{c.summary}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge tone={c.kind === "instant" ? "lagoon" : "sun"}>{c.kind === "instant" ? "Points on scan" : "Teacher checks"}</Badge>
                    <Badge tone="grey">{REPEAT_LABEL[c.repeat_every]}</Badge>
                    {c.place && <Badge tone="grey" icon="qr">{c.place}</Badge>}
                    {!c.active && <Badge tone="red">Off</Badge>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display tabular text-3xl font-black text-leaf-600">+{pts(c.points)}</div>
                  <div className="text-sm text-stone-500">{c.done_this_month} done this month</div>
                </div>
              </div>
              <details className="mt-2">
                <summary className="inline-flex min-h-11 items-center rounded px-1 font-bold text-leaf-600 hover:underline">Edit</summary>
                <ChallengeForm c={c} />
              </details>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Add a challenge">
        <ChallengeForm />
      </Card>
    </div>
  );
}

function ChallengeForm({ c }: { c?: TeacherChallenge }) {
  return (
    <ActionForm action={saveChallenge} submitLabel={c ? "Save" : "Add challenge"} resetOnSuccess={!c} className="mt-3 space-y-3">
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Title"><input name="title" defaultValue={c?.title} required minLength={3} maxLength={60} className={inputClass} /></Field>
        <Field label="Where the QR code goes" hint="For example: next to the recycling bins"><input name="place" defaultValue={c?.place ?? ""} maxLength={80} className={inputClass} /></Field>
      </div>
      <Field label="One-line summary"><input name="summary" defaultValue={c?.summary} required minLength={3} maxLength={200} className={inputClass} /></Field>
      <Field label="What the class has to do"><textarea name="steps" defaultValue={c?.steps} required minLength={3} maxLength={600} rows={3} className={inputClass} /></Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Points"><input name="points" type="number" min="0.5" max="50" step="0.5" defaultValue={c?.points ?? 2} required className={inputClass} /></Field>
        <Field label="How it's checked">
          <select name="kind" defaultValue={c?.kind ?? "instant"} className={inputClass}>
            <option value="instant">Points when the QR is scanned</option>
            <option value="review">Class writes it up, I approve</option>
          </select>
        </Field>
        <Field label="How often">
          <select name="repeat_every" defaultValue={c?.repeat_every ?? "day"} className={inputClass}>
            <option value="day">Once a day</option>
            <option value="week">Once a week</option>
            <option value="month">Once a month</option>
            <option value="once">Once only</option>
          </select>
        </Field>
      </div>
      <label className="flex min-h-11 items-center gap-2 font-bold">
        <input type="checkbox" name="active" defaultChecked={c?.active ?? true} className="h-5 w-5 accent-leaf-600" /> Switched on
      </label>
    </ActionForm>
  );
}
