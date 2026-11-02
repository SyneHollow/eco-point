"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const LINKS = [
  ["/teacher", "Dashboard"],
  ["/teacher/classes", "Classes & PINs"],
  ["/teacher/activity", "Daily records"],
  ["/teacher/points", "Bonus points"],
  ["/teacher/month", "Month close & reports"],
  ["/teacher/criteria", "Checklist"],
  ["/teacher/settings", "Settings"],
] as const;

export function TeacherNav() {
  const path = usePathname();
  return (
    <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2 text-sm font-bold">
      {LINKS.map(([href, label]) => {
        const active = href === "/teacher" ? path === href : path.startsWith(href);
        return (
          <Link key={href} href={href} className={cx("whitespace-nowrap rounded-lg px-3 py-2", active ? "bg-leaf-700 text-white" : "text-leaf-800 hover:bg-leaf-50")}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
