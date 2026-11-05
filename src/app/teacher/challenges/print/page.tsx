import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { PrintButton } from "@/components/client";
import { Banner, Logo } from "@/components/ui";
import { Icon } from "@/components/icons";
import { pts } from "@/lib/format";
import { requireTeacher } from "@/lib/session";
import { teacherChallenges } from "@/lib/teacher-data";
import { REPEAT_LABEL } from "@/lib/rewards";

export const metadata = { title: "Print QR codes" };

/** The address printed into each QR code: NEXT_PUBLIC_SITE_URL if set, else the address this page was opened on. */
async function siteUrl() {
  const fixed = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (fixed && /^https?:\/\/[^\s/]+$/.test(fixed)) return fixed;
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000").split(",")[0].trim();
  const local = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(host);
  const proto = (h.get("x-forwarded-proto") ?? (local ? "http" : "https")).split(",")[0].trim();
  return `${proto}://${host}`;
}

export default async function PrintQrPage() {
  const me = await requireTeacher();
  const [list, base] = await Promise.all([teacherChallenges(), siteUrl()]);
  const active = list.filter((c) => c.active);
  const local = /\/\/(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(base);
  const posters = await Promise.all(
    active.map(async (c) => {
      const url = `${base}/c/${c.token}`;
      const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0d3b2e", light: "#ffffff" } });
      return { c, url, svg };
    }),
  );

  return (
    <div className="space-y-5">
      <style>{`@media print { @page { size: A4 portrait; margin: 12mm } }`}</style>
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href="/teacher/challenges" className="inline-flex min-h-11 items-center gap-2 rounded font-bold text-leaf-600 hover:underline">
          <Icon name="back" size={18} />
          Eco challenges
        </Link>
        <PrintButton label="Print all posters" />
      </div>
      <div className="no-print space-y-3">
        <p className="text-stone-600">
          One A4 poster per challenge that&apos;s switched on ({active.length}). Stick each one where its challenge happens. Codes point to <strong>{base}</strong>.
        </p>
        {local && (
          <Banner tone="flag" icon="warning">
            You opened this page on this computer&apos;s own address, so phones and tablets can&apos;t open these codes. Print them from the live
            site (your Vercel address), or set NEXT_PUBLIC_SITE_URL to it.
          </Banner>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2 print:block">
        {posters.map(({ c, url, svg }) => (
          <section key={c.id} className="print-plain flex flex-col rounded-xl border border-line bg-white p-8 print:h-[272mm] print:break-after-page print:p-0">
            <div className="flex items-center justify-between gap-4 border-b-2 border-pitch pb-4">
              <Logo />
              <span className="text-right font-bold text-stone-600">{me.school_name}</span>
            </div>
            <p className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-leaf-100 px-4 py-1.5 text-lg font-bold text-leaf-700">
              <Icon name="qr" size={20} />
              Eco challenge
            </p>
            <h1 className="font-display mt-3 text-7xl leading-none font-black">{c.title}</h1>
            <p className="mt-3 text-2xl text-stone-700">{c.summary}</p>
            <div className="mt-6 flex items-center gap-6">
              <div className="w-56 shrink-0 rounded-xl border-4 border-pitch p-2 print:w-[70mm]" dangerouslySetInnerHTML={{ __html: svg }} />
              <div>
                <div className="font-display tabular text-7xl leading-none font-black text-leaf-600">+{pts(c.points)}</div>
                <div className="text-2xl font-bold">points for your class</div>
                <div className="mt-2 text-xl text-stone-600">{REPEAT_LABEL[c.repeat_every]}</div>
              </div>
            </div>
            <h2 className="mt-6 text-2xl font-bold">What to do</h2>
            <p className="mt-1 text-xl">{c.steps}</p>
            <p className="mt-4 rounded-xl bg-leaf-50 px-4 py-3 text-xl font-semibold">
              {c.kind === "instant"
                ? "Then scan this code with your class tablet's camera, log in, and tap “We did it!”"
                : "Then scan this code with your class tablet's camera, log in, and write what your class did or found. Your teacher approves it."}
            </p>
            <div className="mt-auto flex items-end justify-between gap-4 pt-6 text-sm text-stone-500">
              <span className="break-all">{url}</span>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
