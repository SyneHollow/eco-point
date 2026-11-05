import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/client";
import { Badge, Banner, cx, Field, inputClass } from "@/components/ui";
import { Icon } from "@/components/icons";
import { createClient } from "@/lib/supabase/server";
import { requireMonitor } from "@/lib/session";
import { fmtLongDay } from "@/lib/dates";
import { leaves, pts } from "@/lib/format";
import { REPEAT_AGAIN, REPEAT_LABEL, type MyChallenges } from "@/lib/rewards";
import { claimChallenge } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Eco challenge" };

export default async function ChallengePage({ params }: { params: Promise<{ token: string }> }) {
  await requireMonitor();
  const { token } = await params;
  if (!/^[a-z0-9]{10}$/i.test(token)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_challenges");
  if (error || !data) throw new Error(error?.message ?? "Could not load challenges");
  const c = data as MyChallenges;
  const x = c.challenges.find((y) => y.token === token.toLowerCase());

  if (!x) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <h1 className="font-display text-5xl font-black">This code isn&apos;t a challenge</h1>
        <p className="mt-2 text-stone-600">It may have been switched off. Ask your teacher, or pick another challenge.</p>
        <Link href="/monitor/challenges" className="mt-4 inline-flex min-h-11 items-center gap-2 font-bold text-leaf-600 underline underline-offset-4">
          <Icon name="back" size={18} />
          All eco challenges
        </Link>
      </main>
    );
  }

  const done = x.status === "approved";
  const pending = x.status === "pending";
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-5 px-4 py-6">
      <Link href="/monitor/challenges" className="inline-flex min-h-11 items-center gap-2 font-bold text-leaf-600 hover:underline">
        <Icon name="back" size={18} />
        All eco challenges
      </Link>
      <section className={cx("rounded-2xl border bg-white p-6", done ? "border-leaf-500/50" : "border-line")}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-5xl leading-none font-black">{x.title}</h1>
            <p className="mt-2 text-lg text-stone-600">{x.summary}</p>
          </div>
          <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
            <div className="rounded-xl bg-chalk px-4 py-2 text-center">
              <div className="font-display tabular text-4xl font-black text-pitch">+{pts(x.points)}</div>
              <div className="text-sm font-bold text-stone-600">{Number(x.points) === 1 ? "point" : "points"}</div>
            </div>
            {x.leaves > 0 && (
              <div className="rounded-xl bg-team-lime/40 px-4 py-2 text-center">
                <div className="font-display tabular text-4xl font-black text-leaf-800">+{x.leaves}</div>
                <div className="flex items-center justify-center gap-1 text-sm font-bold text-leaf-800">
                  <Icon name="leaf" size={14} />
                  {x.leaves === 1 ? "leaf" : "leaves"}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="grey">{REPEAT_LABEL[x.repeat_every]}</Badge>
          <Badge tone={x.kind === "instant" ? "lagoon" : "sun"} icon={x.kind === "instant" ? "qr" : "records"}>
            {x.kind === "instant" ? "Points and leaves straight away" : "Your teacher checks it"}
          </Badge>
        </div>
        <h2 className="mt-6 text-lg font-bold">What to do</h2>
        <p className="mt-1 text-lg">{x.steps}</p>
        {x.place && (
          <p className="mt-3 flex items-center gap-2 text-stone-600">
            <Icon name="qr" size={18} />
            Where the QR code is: {x.place}
          </p>
        )}
      </section>

      {!c.open && c.points_start_date ? (
        <Banner>Eco challenges open when points start on {fmtLongDay(c.points_start_date)}.</Banner>
      ) : done ? (
        <Banner tone="leaf" icon="check">
          Done! +{pts(x.points)} points{x.leaves > 0 ? ` and +${leaves(x.leaves)}` : ""} for your class. {REPEAT_AGAIN[x.repeat_every]}
        </Banner>
      ) : pending ? (
        <Banner icon="clock">Sent to your teacher. The points and leaves arrive when they approve it.</Banner>
      ) : (
        <section className="rounded-2xl border border-line bg-white p-6">
          {x.last_rejected && (
            <div className="mb-4">
              <Banner tone="flag" icon="refresh">Your teacher asked you to try again: {x.last_rejected}</Banner>
            </div>
          )}
          {x.kind === "instant" ? (
            <ActionForm action={claimChallenge} submitLabel="We did it!" pendingLabel="Saving…" resetOnSuccess={false} buttonClassName="w-full min-h-14 text-lg">
              <input type="hidden" name="token" value={x.token} />
              <p className="mb-4 text-stone-600">Only tap this once your class has really done it. Your teacher can see every challenge you complete.</p>
            </ActionForm>
          ) : (
            <ActionForm action={claimChallenge} submitLabel="Send to my teacher" pendingLabel="Sending…" resetOnSuccess={false} buttonClassName="w-full min-h-14 text-lg" className="space-y-4">
              <input type="hidden" name="token" value={x.token} />
              <Field label="What did your class do or find?" hint="A few sentences. Don't write anyone's name.">
                <textarea name="answer" required minLength={15} maxLength={1000} rows={5} className={inputClass} />
              </Field>
            </ActionForm>
          )}
        </section>
      )}
    </main>
  );
}
