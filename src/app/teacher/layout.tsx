import { Footer } from "@/components/ui";
import { Icon } from "@/components/icons";
import { requireTeacher } from "@/lib/session";
import { logout } from "../login/actions";
import { TeacherNav } from "./nav";

export const dynamic = "force-dynamic";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const me = await requireTeacher();
  return (
    <div className="flex-1 lg:flex">
      <aside className="no-print on-dark relative z-30 bg-pitch text-white lg:w-64 lg:shrink-0">
        <div className="lg:sticky lg:top-0 lg:max-h-dvh lg:overflow-y-auto">
          <TeacherNav />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col lg:min-h-dvh">
        <div className="no-print border-b border-line bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 lg:px-8">
            <span className="truncate font-semibold text-stone-500">{me.school_name}</span>
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden font-semibold sm:inline">{me.display_name}</span>
              <form action={logout}>
                <button className="flex min-h-11 items-center gap-1.5 rounded-[10px] px-3 font-bold text-stone-600 hover:bg-stone-100 hover:text-pitch">
                  <Icon name="signOut" size={18} />
                  Log out
                </button>
              </form>
            </div>
          </div>
        </div>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
