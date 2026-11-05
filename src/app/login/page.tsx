import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/client";
import { cx, Field, Footer, inputClass, Logo, teamColor } from "@/components/ui";
import { Icon } from "@/components/icons";
import { getClasses, getSchool } from "@/lib/public-data";
import { getMe } from "@/lib/session";
import { loginMonitor, loginTeacher } from "./actions";
import { safeNext } from "@/lib/next-path";

export const dynamic = "force-dynamic";
export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ as?: string; next?: string }> }) {
  const me = await getMe();
  const { as, next: rawNext } = await searchParams;
  const next = safeNext(rawNext);
  if (me) redirect(me.role === "teacher" ? "/teacher" : (next ?? "/monitor"));
  const teacher = as === "teacher";
  const [school, classes] = await Promise.all([getSchool(), getClasses()]);
  const tab = (active: boolean) =>
    cx(
      "flex min-h-11 items-center justify-center rounded-[10px] font-bold transition-colors",
      active ? "bg-white text-pitch" : "text-leaf-100 hover:bg-white/10 hover:text-white",
    );

  return (
    <>
      <div className="on-dark bg-pitch px-4 pt-6 pb-16 text-white">
        <div className="mx-auto max-w-md">
          <Link href="/" className="inline-flex rounded-lg">
            <Logo dark />
          </Link>
          <h1 className="font-display mt-8 text-6xl font-black">{teacher ? "Teacher login" : "Today's eco check"}</h1>
          {school && <p className="mt-1 text-leaf-200">{school.name}</p>}
          <nav aria-label="Who is logging in" className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-white/[0.08] p-1">
            <Link href="/login" aria-current={!teacher ? "page" : undefined} className={tab(!teacher)}>
              Eco Monitor
            </Link>
            <Link href="/login?as=teacher" aria-current={teacher ? "page" : undefined} className={tab(teacher)}>
              Teacher
            </Link>
          </nav>
        </div>
      </div>

      <main className="mx-auto -mt-10 w-full max-w-md flex-1 px-4">
        <div className="rounded-2xl border border-line bg-white p-5 sm:p-6">
          {teacher ? (
            <ActionForm action={loginTeacher} submitLabel="Log in" pendingLabel="Logging in…" className="space-y-4" resetOnSuccess={false} buttonClassName="w-full">
              <Field label="Email">
                <input name="email" type="email" autoComplete="username" required className={inputClass} />
              </Field>
              <Field label="Password">
                <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
              </Field>
            </ActionForm>
          ) : (
            <ActionForm
              action={loginMonitor}
              submitLabel="Start today's check"
              pendingLabel="Logging in…"
              className="space-y-5"
              resetOnSuccess={false}
              buttonClassName="w-full min-h-14 text-lg"
            >
              {next && <input type="hidden" name="next" value={next} />}
              {next?.startsWith("/c/") && (
                <p className="flex items-start gap-2 rounded-[10px] bg-leaf-50 px-3 py-2.5 font-semibold text-leaf-700">
                  <Icon name="qr" size={20} className="mt-0.5 shrink-0" />
                  Log in to finish the eco challenge you scanned.
                </p>
              )}
              <fieldset>
                <legend className="mb-2 text-[15px] font-bold">Tap your class</legend>
                <div className="grid grid-cols-4 gap-2">
                  {classes.map((c) => (
                    <label key={c.id} className="relative block">
                      <input type="radio" name="class_id" value={c.id} required className="peer sr-only" />
                      <span
                        className="team-tile h-14 w-full text-3xl transition-[outline,transform] peer-checked:-translate-y-0.5 peer-checked:outline-3 peer-checked:outline-offset-2 peer-checked:outline-pitch peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-pitch"
                        style={{ background: teamColor(c.name) }}
                      >
                        {c.name}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <Field label="Class PIN" hint="6 digits. Your teacher gives this to your class's Eco Monitors.">
                <input
                  name="pin"
                  type="password"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  autoComplete="off"
                  required
                  className={cx(inputClass, "tabular min-h-14 text-center text-3xl tracking-[0.4em]")}
                />
              </Field>
            </ActionForm>
          )}
        </div>
        <p className="mt-6 text-center">
          <Link href="/leaderboard" className="rounded font-bold text-leaf-600 underline underline-offset-4 hover:text-pitch">
            See the leaderboard without logging in
          </Link>
        </p>
      </main>
      <Footer />
    </>
  );
}
