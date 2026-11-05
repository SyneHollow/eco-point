"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx, Logo } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";

const GROUPS: Array<{ label: string; links: Array<[string, string, IconName]> }> = [
  {
    label: "Every day",
    links: [
      ["/teacher", "Dashboard", "dashboard"],
      ["/teacher/activity", "Daily records", "records"],
      ["/teacher/ai", "AI checks & flags", "flag"],
    ],
  },
  {
    label: "Competition",
    links: [
      ["/teacher/points", "Bonus points & leaves", "star"],
      ["/teacher/challenges", "Eco challenges", "qr"],
      ["/teacher/rewards", "Badges & gardens", "medal"],
      ["/teacher/assistant", "Ask EcoPoints", "chat"],
      ["/teacher/month", "Month close & reports", "calendar"],
    ],
  },
  {
    label: "Setup",
    links: [
      ["/teacher/classes", "Classes & PINs", "key"],
      ["/teacher/criteria", "Checklist", "checklist"],
      ["/teacher/settings", "Settings", "gear"],
    ],
  },
];

function NavList({ path }: { path: string }) {
  return (
    <div className="space-y-5">
      {GROUPS.map((g) => (
        <div key={g.label}>
          <p className="px-3 pb-1.5 text-sm font-semibold text-leaf-200">{g.label}</p>
          <ul className="space-y-0.5">
            {g.links.map(([href, label, icon]) => {
              const active = href === "/teacher" ? path === href : path.startsWith(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "flex min-h-11 items-center gap-3 rounded-[10px] px-3 font-bold transition-colors",
                      active ? "bg-white text-pitch" : "text-leaf-100 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <Icon name={icon} size={20} className={active ? "text-leaf-600" : undefined} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Sidebar on large screens; a Menu disclosure on phones (remounted per page so it closes after navigating). */
export function TeacherNav() {
  const path = usePathname();
  return (
    <>
      <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-5 lg:pt-6 lg:pb-8">
        <Link href="/teacher" className="rounded-lg">
          <Logo dark />
        </Link>
        <details key={path} className="group lg:hidden">
          <summary className="flex min-h-11 list-none items-center gap-2 rounded-[10px] border-[1.5px] border-white/30 px-3 font-bold [&::-webkit-details-marker]:hidden">
            <Icon name="menu" size={20} />
            Menu
          </summary>
          <nav aria-label="Teacher" className="absolute inset-x-0 z-40 mt-3 border-t border-white/10 bg-pitch px-3 pt-4 pb-6 shadow-xl">
            <NavList path={path} />
          </nav>
        </details>
      </div>
      <nav aria-label="Teacher" className="hidden px-3 pb-8 lg:block">
        <NavList path={path} />
      </nav>
    </>
  );
}
