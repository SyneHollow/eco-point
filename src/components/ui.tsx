import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { CREDIT } from "@/lib/config";
import { Icon, type IconName } from "@/components/icons";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* ---------- Brand ---------- */

/** Leaf whose midrib is an up-right arrow: points going up. */
export function LeafMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true" focusable="false">
      <rect width="40" height="40" rx="10" fill="#b5e354" />
      <path d="M8.5 31.5C8.5 18.5 17 9.5 32 8.5c-1 15-10 23-23.5 23Z" fill="#0d3b2e" />
      <path d="M12.5 27.5 25 15" stroke="#b5e354" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M19 15h6v6" stroke="#b5e354" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function Logo({ dark = false, size = "md" }: { dark?: boolean; size?: "md" | "lg" }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LeafMark className={size === "lg" ? "h-11 w-11" : "h-8 w-8"} />
      <span className={cx("font-display font-extrabold", size === "lg" ? "text-4xl" : "text-[28px]", dark ? "text-white" : "text-pitch")}>
        EcoPoints
      </span>
    </span>
  );
}

/* ---------- Teams and ranks ---------- */

const TEAM = ["#b5e354", "#5fdcc8", "#74c0fc", "#a5b4fc", "#d0a6f8", "#ff9cc0", "#ff9e80", "#ffd966"];

/** Fixed colour per class. "7A".."7D" and "8A".."8D" get eight different colours; other names hash. */
export function teamColor(name: string): string {
  const m = /^(\d+)\s*([A-Za-z])?/.exec(name.trim());
  const i = m
    ? (Number(m[1]) - 1) * 4 + (m[2] ? m[2].toUpperCase().charCodeAt(0) - 65 : 0)
    : [...name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  return TEAM[((i % 8) + 8) % 8];
}

const TILE = {
  xs: "h-7 min-w-9 px-1.5 text-lg",
  sm: "h-9 min-w-11 px-2 text-2xl",
  md: "h-12 min-w-14 px-2.5 text-[32px]",
  lg: "h-16 min-w-20 px-3 text-5xl",
  xl: "h-24 min-w-28 px-4 text-7xl",
  tv: "h-14 min-w-24 px-3 text-5xl",
};

/** The class "bib": its code on its team colour. */
export function TeamTile({ name, size = "sm", className, style }: { name: string; size?: keyof typeof TILE; className?: string; style?: CSSProperties }) {
  return (
    <span className={cx("team-tile", TILE[size], className)} style={{ background: teamColor(name), ...style }}>
      {name}
    </span>
  );
}

const ORDINAL = ["1st", "2nd", "3rd"];
const MEDAL: Record<number, [string, string]> = {
  1: ["#ffc233", "#a87400"],
  2: ["#dbe3e8", "#7d8b96"],
  3: ["#eea56e", "#9c5a2c"],
};

/** SVG medal for the top three, a plain numeral after that. */
export function Medal({ rank, size = 32, className }: { rank: number; size?: number; className?: string }) {
  if (rank > 3) {
    return (
      <span className={cx("font-display tabular font-extrabold", className)} aria-label={`Rank ${rank}`}>
        {rank}
      </span>
    );
  }
  const [fill, edge] = MEDAL[rank];
  return (
    <svg viewBox="0 0 32 40" width={size * 0.8} height={size} className={className} role="img" aria-label={`${ORDINAL[rank - 1]} place`}>
      <path d="M7 0h8l3.5 13h-8z" fill="#23935a" />
      <path d="M25 0h-8l-3.5 13h8z" fill="#b5e354" />
      <circle cx="16" cy="26" r="12.5" fill={fill} stroke={edge} strokeWidth="2.5" />
      <text x="16" y="32" textAnchor="middle" style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 17 }} fill="#0d3b2e">
        {rank}
      </text>
    </svg>
  );
}

/* ---------- Surfaces ---------- */

/** A bordered white panel. Title is plain bold text; the display face is kept for page titles and numbers. */
export function Card({
  children,
  className,
  title,
  action,
  id,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className={cx("rounded-xl border border-line bg-white", className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-5 pt-4">
          <h2 className="text-lg font-bold leading-snug text-pitch">{title}</h2>
          {action}
        </header>
      )}
      <div className={cx("p-5", title || action ? "pt-3" : null)}>{children}</div>
    </section>
  );
}

export function PageTitle({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-5xl font-extrabold text-pitch">{title}</h1>
        {sub && <p className="mt-1.5 text-stone-500">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const BADGE = {
  leaf: "bg-leaf-100 text-leaf-700",
  sun: "bg-sun-100 text-sun-700",
  grey: "bg-stone-100 text-stone-600",
  red: "bg-red-50 text-red-700",
  lagoon: "bg-lagoon-100 text-lagoon-700",
};

export function Badge({ children, tone = "leaf", icon }: { children: ReactNode; tone?: keyof typeof BADGE; icon?: IconName }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-bold whitespace-nowrap", BADGE[tone])}>
      {icon && <Icon name={icon} size={14} />}
      {children}
    </span>
  );
}

export function SdgChips({ sdgs }: { sdgs: number[] | null | undefined }) {
  if (!sdgs?.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {sdgs.map((g) => (
        <span
          key={g}
          className="rounded-md border border-lagoon-500/30 px-1.5 py-px text-xs font-bold text-lagoon-700"
          title={`UN Sustainable Development Goal ${g}`}
        >
          SDG {g}
        </span>
      ))}
    </span>
  );
}

/* ---------- Buttons ---------- */

const BTN = {
  primary: "bg-pitch text-white shadow-[inset_0_-3px_0_rgb(0_0_0/0.28)] hover:bg-leaf-800",
  secondary: "border-[1.5px] border-pitch/30 bg-white text-pitch hover:border-pitch",
  light: "bg-white text-pitch shadow-[inset_0_-3px_0_rgb(13_59_46/0.18)] hover:bg-leaf-50",
  ghostDark: "border-[1.5px] border-white/35 text-white hover:border-white hover:bg-white/10",
  sun: "bg-sun-500 text-pitch shadow-[inset_0_-3px_0_rgb(0_0_0/0.18)] hover:bg-sun-300",
  danger: "border-[1.5px] border-red-300 bg-white text-red-700 hover:border-red-600 hover:bg-red-50",
};
export type BtnVariant = keyof typeof BTN;
export const buttonClass = (variant: BtnVariant = "primary", extra?: string) =>
  cx(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-4 py-2 text-[15px] font-bold transition-colors duration-150",
    "active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0",
    BTN[variant],
    extra,
  );

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className,
  icon,
}: {
  href: string;
  children: ReactNode;
  variant?: BtnVariant;
  className?: string;
  icon?: IconName;
}) {
  return (
    <Link href={href} className={buttonClass(variant, className)}>
      {icon && <Icon name={icon} size={18} />}
      {children}
    </Link>
  );
}

/* ---------- Messages and forms ---------- */

const BANNER: Record<string, { cls: string; icon: IconName }> = {
  sun: { cls: "border-sun-500/50 bg-sun-100 text-sun-700", icon: "info" },
  leaf: { cls: "border-leaf-500/40 bg-leaf-50 text-leaf-700", icon: "trophy" },
  lagoon: { cls: "border-lagoon-500/40 bg-lagoon-100 text-lagoon-700", icon: "info" },
  flag: { cls: "border-red-300 bg-red-50 text-red-800", icon: "flag" },
};

export function Banner({ children, tone = "sun", icon }: { children: ReactNode; tone?: keyof typeof BANNER; icon?: IconName }) {
  const t = BANNER[tone];
  return (
    <div className={cx("flex items-start gap-2.5 rounded-[10px] border px-4 py-3 text-[15px] font-semibold", t.cls)}>
      <Icon name={icon ?? t.icon} size={20} className="mt-px shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[15px] font-bold text-pitch">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-sm text-stone-500">{hint}</span>}
    </label>
  );
}

/** 16px text so phones don't zoom on focus; 1.5px border at 3:1 against white. */
export const inputClass =
  "w-full min-h-11 rounded-[10px] border-[1.5px] border-stone-400 bg-white px-3 py-2 text-base text-pitch placeholder:text-stone-400 focus:border-pitch";

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-[10px] border border-dashed border-stone-300 px-4 py-6 text-center text-[15px] text-stone-500">{children}</p>;
}

export function Footer({ dark = false }: { dark?: boolean }) {
  return (
    <footer className={cx("no-print mt-auto px-4 py-6 text-center text-sm", dark ? "text-leaf-200" : "text-stone-500")}>
      {CREDIT}
    </footer>
  );
}
