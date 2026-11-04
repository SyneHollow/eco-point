import Link from "next/link";
import { cx, Logo } from "@/components/ui";

export function PublicHeader({ schoolName, current }: { schoolName?: string; current?: "leaderboard" | "login" }) {
  const item = (href: string, label: string, key: typeof current) => (
    <Link
      href={href}
      aria-current={current === key ? "page" : undefined}
      className={cx(
        "rounded-lg px-3 py-2 font-bold transition-colors",
        current === key ? "bg-white/12 text-white" : "text-leaf-100 hover:bg-white/10 hover:text-white",
      )}
    >
      {label}
    </Link>
  );
  return (
    <header className="no-print on-dark bg-pitch text-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex min-w-0 items-center gap-3 rounded-lg">
          <Logo dark />
          {schoolName && <span className="hidden truncate border-l border-white/20 pl-3 font-semibold text-leaf-200 sm:inline">{schoolName}</span>}
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 text-[15px]">
          {item("/leaderboard", "Leaderboard", "leaderboard")}
          {item("/login", "Log in", "login")}
        </nav>
      </div>
    </header>
  );
}
