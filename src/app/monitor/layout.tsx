import Link from "next/link";
import { Footer, Logo, TeamTile } from "@/components/ui";
import { Icon } from "@/components/icons";
import { requireMonitor } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { MyLeaves } from "@/lib/rewards";
import { fmtLongDay } from "@/lib/dates";
import { logout } from "../login/actions";
import { MonitorTabs } from "./tabs";
import { LeafCounter } from "./leaf-counter";

export const dynamic = "force-dynamic";

export default async function MonitorLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMonitor();
  const name = me.class_name ?? "";
  // The garden wallet. Read-only (badge leaves are handed out on the garden page).
  const supabase = await createClient();
  const { data: leafData } = await supabase.rpc("my_leaves");
  const wallet = (leafData ?? null) as MyLeaves | null;
  return (
    <>
      <header className="on-dark bg-pitch text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="rounded-lg">
            <Logo dark />
          </Link>
          <form action={logout}>
            <button className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 font-bold text-leaf-100 hover:bg-white/10 hover:text-white">
              <Icon name="signOut" size={18} />
              Log out
            </button>
          </form>
        </div>
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 pt-1 pb-5">
          <TeamTile name={name} size="lg" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-leaf-200 sm:text-base">{fmtLongDay(me.today)}</p>
            <p className="font-display text-4xl font-black">Class {name}</p>
            <p className="text-leaf-100">{me.display_name}</p>
          </div>
          {wallet && <LeafCounter initial={wallet.available} />}
        </div>
        <MonitorTabs />
      </header>
      {children}
      <Footer />
    </>
  );
}
