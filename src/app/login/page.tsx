import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/client";
import { Card, cx, Field, Footer, inputClass, Logo } from "@/components/ui";
import { getClasses, getSchool } from "@/lib/public-data";
import { getMe } from "@/lib/session";
import { loginMonitor, loginTeacher } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  const me = await getMe();
  if (me) redirect(me.role === "teacher" ? "/teacher" : "/monitor");
  const { as } = await searchParams;
  const teacher = as === "teacher";
  const [school, classes] = await Promise.all([getSchool(), getClasses()]);

  return (
    <>
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-10">
        <Link href="/" className="mb-8 flex justify-center">
          <Logo size="lg" />
        </Link>
        {school && <p className="-mt-5 mb-6 text-center text-sm font-bold text-stone-500">{school.name}</p>}

        <div className="mb-4 grid grid-cols-2 rounded-2xl bg-white p-1 text-sm font-bold ring-1 ring-leaf-900/5">
          <Link href="/login" className={cx("rounded-xl py-2.5 text-center", !teacher ? "bg-leaf-700 text-white" : "text-leaf-800")}>
            Eco Monitor
          </Link>
          <Link href="/login?as=teacher" className={cx("rounded-xl py-2.5 text-center", teacher ? "bg-leaf-700 text-white" : "text-leaf-800")}>
            Teacher
          </Link>
        </div>

        <Card>
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
            <ActionForm action={loginMonitor} submitLabel="Start today's check" pendingLabel="Logging in…" className="space-y-4" resetOnSuccess={false} buttonClassName="w-full py-3 text-base">
              <Field label="Your class">
                <select name="class_id" required defaultValue="" className={cx(inputClass, "py-3 text-base")}>
                  <option value="" disabled>
                    Choose…
                  </option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Class PIN" hint="6 digits, given to your class's Eco Monitors by your teacher.">
                <input
                  name="pin"
                  type="password"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  autoComplete="off"
                  required
                  className={cx(inputClass, "tabular py-3 text-center text-2xl tracking-[0.5em]")}
                />
              </Field>
            </ActionForm>
          )}
        </Card>
        <p className="mt-6 text-center text-sm">
          <Link href="/leaderboard" className="font-bold text-leaf-700 hover:underline">
            See the leaderboard without logging in →
          </Link>
        </p>
      </main>
      <Footer />
    </>
  );
}
