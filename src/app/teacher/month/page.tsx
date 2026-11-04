import Link from "next/link";
import { ActionForm } from "@/components/client";
import { Badge, buttonClass, Card, TeamTile } from "@/components/ui";
import { Icon } from "@/components/icons";
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
        <h1 className="font-display text-5xl font-extrabold">Month close &amp; reports</h1>
        <p className="mt-2 max-w-2xl text-stone-600">
          After a month ends, close it to name the Green Champion. Closing locks that month&apos;s points for good, so do any voids or
          adjustments first. Then print the certificate and the impact report.
        </p>
      </div>

      <Card title={`${fmtMonth(current)} (in progress)`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-stone-600">Can be closed from the 1st of next month. The live report is available now.</p>
          <Link href={`/teacher/month/${current.slice(0, 7)}/report`} className={buttonClass("secondary")}>
            Live impact report
          </Link>
        </div>
      </Card>

      <Card title="Past months">
        <ul className="divide-y divide-line">
          {months.map((month) => {
            const c = closed.get(month);
            const ym = month.slice(0, 7);
            return (
              <li key={month} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <div className="text-lg font-bold">{fmtMonth(month)}</div>
                  {c ? (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge icon="lock">Closed</Badge>
                      <span className="inline-flex items-center gap-1.5 text-stone-600">
                        <Icon name="trophy" size={18} className="text-sun-700" />
                        Champion
                      </span>
                      {c.class_name && <TeamTile name={c.class_name} size="xs" />}
                      <span className="tabular font-bold">{pts(c.points)} pts</span>
                      {c.was_tie && <span className="text-sm text-stone-500">(tie, decided on days submitted)</span>}
                    </div>
                  ) : (
                    <div className="mt-1">
                      <Badge tone="grey">Open</Badge>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/teacher/month/${ym}/report`} className={buttonClass("secondary")}>
                    Impact report
                  </Link>
                  {c ? (
                    <Link href={`/teacher/month/${ym}/certificate`} className={buttonClass("sun")}>
                      <Icon name="trophy" size={18} />
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
