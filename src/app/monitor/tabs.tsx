"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";

const TABS: Array<[string, string, IconName]> = [
  ["/monitor", "Today", "checklist"],
  ["/monitor/garden", "Garden", "plant"],
  ["/monitor/challenges", "Challenges", "qr"],
];

/** Folder tabs: the active one joins the page below. */
export function MonitorTabs() {
  const path = usePathname();
  return (
    <nav aria-label="Monitor" className="mx-auto flex max-w-6xl gap-1 px-4">
      {TABS.map(([href, label, icon]) => {
        const active = href === "/monitor" ? path === href : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex min-h-12 flex-1 items-center justify-center gap-2 rounded-t-xl px-3 font-bold transition-colors sm:flex-none sm:px-5",
              active ? "bg-chalk text-pitch" : "text-leaf-100 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon name={icon} size={20} className={active ? "text-leaf-600" : undefined} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
