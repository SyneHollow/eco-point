import Link from "next/link";
import { Logo } from "@/components/ui";

export function PublicHeader({ schoolName }: { schoolName?: string }) {
  return (
    <header className="no-print border-b border-leaf-900/5 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          <Logo />
          {schoolName && <span className="hidden border-l border-stone-200 pl-3 text-sm font-bold text-stone-500 sm:inline">{schoolName}</span>}
        </Link>
        <nav className="flex items-center gap-1 text-sm font-bold">
          <Link href="/leaderboard" className="rounded-lg px-3 py-2 text-leaf-800 hover:bg-leaf-50">Leaderboard</Link>
          <Link href="/login" className="rounded-lg px-3 py-2 text-leaf-800 hover:bg-leaf-50">Log in</Link>
        </nav>
      </div>
    </header>
  );
}
