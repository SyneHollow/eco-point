import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/client";
import { LeafMark, teamColor } from "@/components/ui";
import { Icon } from "@/components/icons";
import { fmtMonth } from "@/lib/dates";
import { pts } from "@/lib/format";
import { getChampions } from "@/lib/public-data";
import { requireTeacher } from "@/lib/session";

export const metadata = { title: "Certificate" };

export default async function CertificatePage({ params }: { params: Promise<{ month: string }> }) {
  const me = await requireTeacher();
  const { month } = await params;
  if (!/^\d{4}-\d{2}$/.test(month)) notFound();
  const champ = (await getChampions()).find((c) => c.month === `${month}-01`);

  if (!champ?.class_name) {
    return (
      <div className="space-y-4">
        <p>{fmtMonth(`${month}-01`)} hasn&apos;t been closed yet, so there&apos;s no champion to print.</p>
        <Link href="/teacher/month" className="inline-flex min-h-11 items-center gap-2 font-bold text-leaf-600 hover:underline">
          <Icon name="back" size={18} />
          Month close
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <style>{`@media print { @page { size: A4 landscape; margin: 0 } header, nav, footer { display: none !important } main { padding: 0 !important; max-width: none !important } }`}</style>
      <div className="no-print flex items-center justify-between">
        <Link href="/teacher/month" className="inline-flex min-h-11 items-center gap-2 rounded font-bold text-leaf-600 hover:underline">
          <Icon name="back" size={18} />
          Month close
        </Link>
        <PrintButton />
      </div>
      <div className="@container mx-auto aspect-[297/210] w-full max-w-5xl border border-line bg-white p-[3%] [print-color-adjust:exact] print:max-w-none print:border-0">
        <div className="relative flex h-full flex-col items-center justify-center rounded-[1.5rem] border-[10px] border-pitch p-[4%] text-center outline outline-4 outline-offset-[-22px] outline-sun-500">
          <LeafMark className="h-[7cqw] w-[7cqw]" />
          <p className="mt-4 text-xl font-bold text-leaf-600">{me.school_name}</p>
          <h1 className="font-display mt-[1.5cqw] text-[6.2cqw] font-black">Green Champion of the Month</h1>
          <p className="mt-2 text-xl font-semibold text-stone-600">{fmtMonth(champ.month)}</p>
          <p className="mt-6 text-lg text-stone-600">is proudly awarded to</p>
          <p className="font-display mt-[0.5cqw] text-[11cqw] font-black">Class {champ.class_name}</p>
          <span className="mt-2 block h-3 w-48 rounded-full" style={{ background: teamColor(champ.class_name) }} aria-hidden="true" />
          <p className="mt-4 max-w-2xl text-lg text-stone-700">
            for leading the whole school in everyday eco habits this month, with <strong>{pts(champ.points)} EcoPoints</strong>.
          </p>
          <div className="mt-auto grid w-full max-w-3xl grid-cols-2 gap-16 pt-10 text-sm text-stone-600">
            <div className="border-t border-stone-400 pt-2">Class teacher</div>
            <div className="border-t border-stone-400 pt-2">Principal</div>
          </div>
        </div>
      </div>
    </div>
  );
}
