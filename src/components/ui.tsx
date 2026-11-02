import Link from "next/link";
import type { ReactNode } from "react";
import { CREDIT } from "@/lib/config";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function LeafMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <circle cx="20" cy="20" r="19" fill="#1c6338" />
      <path d="M11 27c1-9 7-15 18-16-1 11-7 17-16 17" fill="#86d19f" />
      <path d="M12 28c3-5 7-9 12-12" stroke="#0a2415" strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="29" cy="11" r="3" fill="#f5b700" />
    </svg>
  );
}

export function Logo({ dark = false, size = "md" }: { dark?: boolean; size?: "md" | "lg" }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LeafMark className={size === "lg" ? "h-11 w-11" : "h-8 w-8"} />
      <span className={cx("font-display font-semibold", size === "lg" ? "text-3xl" : "text-xl", dark ? "text-white" : "text-leaf-800")}>
        Eco<span className={dark ? "text-sun-300" : "text-leaf-500"}>Points</span>
      </span>
    </span>
  );
}

export function Card({ children, className, title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cx("rounded-2xl bg-white shadow-sm ring-1 ring-leaf-900/5", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-leaf-900/5 px-5 py-3.5">
          <h2 className="font-display text-lg font-semibold text-leaf-900">{title}</h2>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Badge({ children, tone = "leaf" }: { children: ReactNode; tone?: "leaf" | "sun" | "grey" | "red" | "lagoon" }) {
  const tones = {
    leaf: "bg-leaf-100 text-leaf-800",
    sun: "bg-sun-100 text-sun-700",
    grey: "bg-stone-100 text-stone-600",
    red: "bg-red-50 text-red-700",
    lagoon: "bg-lagoon-100 text-lagoon-700",
  };
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold", tones[tone])}>{children}</span>;
}

export function SdgChips({ sdgs }: { sdgs: number[] | null | undefined }) {
  if (!sdgs?.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {sdgs.map((g) => (
        <span key={g} className="rounded-md bg-lagoon-100 px-1.5 py-0.5 text-[11px] font-bold text-lagoon-700" title={`UN Sustainable Development Goal ${g}`}>
          SDG {g}
        </span>
      ))}
    </span>
  );
}

const btn = {
  primary: "bg-leaf-700 text-white hover:bg-leaf-800",
  secondary: "bg-white text-leaf-800 ring-1 ring-leaf-700/25 hover:bg-leaf-50",
  sun: "bg-sun-500 text-leaf-950 hover:bg-sun-300",
  danger: "bg-white text-red-700 ring-1 ring-red-200 hover:bg-red-50",
};
export type BtnVariant = keyof typeof btn;
export const buttonClass = (variant: BtnVariant = "primary", extra?: string) =>
  cx("inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:opacity-60", btn[variant], extra);

export function ButtonLink({ href, children, variant = "primary", className }: { href: string; children: ReactNode; variant?: BtnVariant; className?: string }) {
  return (
    <Link href={href} className={buttonClass(variant, className)}>
      {children}
    </Link>
  );
}

export function Banner({ children, tone = "sun" }: { children: ReactNode; tone?: "sun" | "leaf" | "lagoon" }) {
  const tones = {
    sun: "bg-sun-100 text-sun-700 ring-sun-500/30",
    leaf: "bg-leaf-100 text-leaf-800 ring-leaf-500/30",
    lagoon: "bg-lagoon-100 text-lagoon-700 ring-lagoon-500/30",
  };
  return <div className={cx("rounded-xl px-4 py-3 text-sm font-semibold ring-1", tones[tone])}>{children}</div>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-leaf-900">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border-0 bg-white px-3 py-2.5 text-sm ring-1 ring-stone-300 focus:ring-2 focus:ring-leaf-500 outline-none";

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-paper px-4 py-6 text-center text-sm text-stone-500">{children}</p>;
}

export function Footer({ dark = false }: { dark?: boolean }) {
  return (
    <footer className={cx("no-print mt-auto px-4 py-6 text-center text-xs", dark ? "text-leaf-200/70" : "text-stone-500")}>
      EcoPoints · {CREDIT}
    </footer>
  );
}

const MEDAL = ["🥇", "🥈", "🥉"];
export function Medal({ rank }: { rank: number }) {
  return <span aria-label={`Rank ${rank}`}>{rank <= 3 ? MEDAL[rank - 1] : rank}</span>;
}
