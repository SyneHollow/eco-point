import Link from "next/link";
import { Badge, Banner, cx } from "@/components/ui";
import { Icon } from "@/components/icons";
import { createClient } from "@/lib/supabase/server";
import { requireMonitor } from "@/lib/session";
import { fmtLongDay } from "@/lib/dates";
import { pts } from "@/lib/format";
import { REPEAT_AGAIN, REPEAT_LABEL, type Challenge, type MyChallenges } from "@/lib/rewards";

export const dynamic = "force-dynamic";
export const metadata = { title: "Eco challenges" };

export default async function ChallengesPage() {
  await requireMonitor();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_challenges");
  if (error || !data) throw new Error(error?.message ?? "Could not load challenges");
  const c = data as MyChallenges;
  const spot = c.challenges.filter((x) => x.kind === "instant");
  const projects = c.challenges.filter((x) => x.kind === "review");

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-6">
      <div>
        <h1 className="font-display text-5xl font-black">Eco challenges</h1>
        <p className="mt-1 max-w-2xl text-stone-600">
          Extra points for real eco actions around school. Look for EcoPoints QR codes, do the challenge, then scan the code with your class
          tablet.
        </p>
      </div>
      {!c.open && c.points_start_date && (
        <Banner>Eco challenges open when points start on {fmtLongDay(c.points_start_date)}.</Banner>
      )}

      <section aria-labelledby="spot-title">
        <h2 id="spot-title" className="text-xl font-bold">Around school: scan the QR code</h2>
        <p className="mt-1 text-stone-600">These only work by scanning the code where the challenge is.</p>
        <ul className="mt-3 grid gap-3 md:grid-cols-3">
          {spot.map((x) => (
            <li key={x.id}>
              <Card x={x} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="proj-title">
        <h2 id="proj-title" className="text-xl font-bold">Class projects: your teacher checks them</h2>
        <p className="mt-1 text-stone-600">Do the project as a class, then write what you did or found. Points arrive when your teacher approves.</p>
        <ul className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((x) => (
            <li key={x.id}>
              <Card x={x} link />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function Card({ x, link = false }: { x: Challenge; link?: boolean }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg leading-snug font-bold">{x.title}</h3>
        <span className="font-display tabular shrink-0 text-2xl font-black text-leaf-600">+{pts(x.points)}</span>
      </div>
      <p className="mt-1 text-stone-600">{x.summary}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {x.status === "approved" ? (
          <Badge icon="check">{x.repeat_every === "day" ? "Done today" : "Done"}</Badge>
        ) : x.status === "pending" ? (
          <Badge tone="sun" icon="clock">Waiting for your teacher</Badge>
        ) : x.last_rejected ? (
          <Badge tone="red" icon="refresh">Try again</Badge>
        ) : (
          <Badge tone="grey">{REPEAT_LABEL[x.repeat_every]}</Badge>
        )}
        {x.place && !link && (
          <span className="inline-flex items-center gap-1 text-sm text-stone-500">
            <Icon name="qr" size={16} />
            {x.place}
          </span>
        )}
      </div>
      {x.status === "approved" && <p className="mt-2 text-sm text-stone-500">{REPEAT_AGAIN[x.repeat_every]}</p>}
    </>
  );
  const cls = "block h-full rounded-xl border bg-white p-4";
  return link ? (
    <Link href={`/monitor/challenges/${x.token}`} className={cx(cls, "border-line transition-colors hover:border-pitch")}>
      {body}
    </Link>
  ) : (
    <div className={cx(cls, x.status === "approved" ? "border-leaf-500/50" : "border-line")}>{body}</div>
  );
}
