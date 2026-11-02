import Link from "next/link";
import { ActionForm } from "@/components/client";
import { Badge, buttonClass, Card } from "@/components/ui";
import { fmtMonth, monthStart, prevMonthStart } from "@/lib/dates";
import { pts } from "@/lib/format";
import { getChampions } from "@/lib/public-data";
import { requireTeacher } from "@/lib/session";
import { closeMonth } from "../actions";

export const metadata = { title: "Month close & reports" };

export default async function MonthPage() {
  const me = await requireTeacher();
  const champions = await getChampions();
  const closed = new Map(champions.map((c) => [c.month, c]));
  const current = monthStart(me.today);
  const months: string[] = [];
  let m = prevMonthStart(me.today);
  for (let i = 0; i < 6; i++) {
    months.push(m);
    m = prevMonthStart(m);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-leaf-900">Month close &amp; reports</h1>
        <p className="max-w-2xl text-sm text-stone-600">
          After a month ends, close it to name the Green Champion. Closing locks that month&apos;s points for good, so do any voids or
          adjustments first. Then print the certificate and the impact report.
        </p>
      </div>

      <Card title={`${fmtMonth(current)} (in progress)`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-stone-600">Can be closed from the 1st of next month. The live report is available now.</p>
          <Link href={`/teacher/month/${current.slice(0, 7)}/report`} className={buttonClass("secondary")}>
            Live impact report
          </Link>
        </div>
      </Card>

      <Card title="Past months">
        <ul className="divide-y divide-stone-100">
          {months.map((month) => {
            const c = closed.get(month);
            const ym = month.slice(0, 7);
            return (
              <li key={month} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <div className="font-display text-xl font-bold text-leaf-900">{fmtMonth(month)}</div>
                  {c ? (
                    <div className="text-sm">
                      <Badge>Closed</Badge> 🏆 <strong>{c.class_name}</strong> · {pts(c.points)} pts{c.was_tie ? " (tie, decided on days submitted)" : ""}
                    </div>
                  ) : (
                    <Badge tone="grey">Open</Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/teacher/month/${ym}/report`} className={buttonClass("secondary")}>
                    Impact report
                  </Link>
                  {c ? (
                    <Link href={`/teacher/month/${ym}/certificate`} className={buttonClass("sun")}>
                      Certificate
                    </Link>
                  ) : (
                    <ActionForm
                      action={closeMonth}
                      submitLabel="Close month & name champion"
                      confirmText={`Close ${fmtMonth(month)}? Its points will be locked for good.`}
                      resetOnSuccess={false}
                    >
                      <input type="hidden" name="month" value={month} />
                    </ActionForm>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
