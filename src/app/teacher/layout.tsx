import Link from "next/link";
import { Footer, Logo } from "@/components/ui";
import { requireTeacher } from "@/lib/session";
import { logout } from "../login/actions";
import { TeacherNav } from "./nav";

export const dynamic = "force-dynamic";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const me = await requireTeacher();
  return (
    <>
      <header className="no-print border-b border-leaf-900/5 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/teacher" className="flex items-center gap-3">
            <Logo />
            <span className="hidden border-l border-stone-200 pl-3 text-sm font-bold text-stone-500 sm:inline">{me.school_name}</span>
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden font-semibold text-stone-600 sm:inline">{me.display_name}</span>
            <form action={logout}>
              <button className="rounded-lg px-3 py-2 font-bold text-leaf-800 hover:bg-leaf-50">Log out</button>
            </form>
          </div>
        </div>
        <TeacherNav />
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      <Footer />
    </>
  );
}
