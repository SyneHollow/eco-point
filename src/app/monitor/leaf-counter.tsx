"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { num } from "@/lib/format";

/** The garden page announces the new balance after buying, without reloading the header. */
export const LEAVES_EVENT = "ecopoints:leaves";
export function announceLeaves(available: number) {
  window.dispatchEvent(new CustomEvent<number>(LEAVES_EVENT, { detail: Math.max(0, available) }));
}

/** Leaves to spend, in the monitor header. Links to the garden. */
export function LeafCounter({ initial }: { initial: number }) {
  const [n, setN] = useState(Math.max(0, initial));
  useEffect(() => setN(Math.max(0, initial)), [initial]);           // the server sent a fresh header
  useEffect(() => {
    const on = (e: Event) => setN((e as CustomEvent<number>).detail);
    window.addEventListener(LEAVES_EVENT, on);
    return () => window.removeEventListener(LEAVES_EVENT, on);
  }, []);
  return (
    <Link
      href="/monitor/garden"
      aria-label={`${num(n)} ${n === 1 ? "leaf" : "leaves"} to spend in your class garden`}
      className="ml-auto flex shrink-0 items-center gap-2 rounded-xl border border-white/20 bg-white/10 py-1.5 pr-3 pl-1.5 hover:bg-white/15 sm:gap-2.5 sm:py-2 sm:pr-4 sm:pl-2"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-team-lime text-pitch sm:h-10 sm:w-10" aria-hidden="true">
        <Icon name="leaf" size={20} />
      </span>
      <span aria-hidden="true">
        <span className="font-display tabular block text-2xl leading-none font-black sm:text-3xl">{num(n)}</span>
        <span className="text-sm font-semibold text-leaf-100">{n === 1 ? "leaf" : "leaves"}</span>
      </span>
    </Link>
  );
}
