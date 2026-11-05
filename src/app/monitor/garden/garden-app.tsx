"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { buttonClass, cx } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";
import { GardenBackdrop, ItemThumb, PLOT_ORDER, PlantArt, PlotSoil, SCENE_VIEWBOX, plotXY } from "@/components/garden-art";
import { BadgeShelf } from "@/components/badge-shelf";
import { fmtDay } from "@/lib/dates";
import { leaves, num } from "@/lib/format";
import { STAGE_NAMES, type Garden, type GardenItem, type Plant } from "@/lib/rewards";
import { buyItem, movePlant, waterPlant, type GardenResult } from "./actions";
import { announceLeaves } from "../leaf-counter";

type Toast = { tone: "ok" | "error"; text: string } | null;
type Celebrate = { item: string; title: string; text: string } | null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** "8 more leaves", "1 more leaf" */
const moreLeaves = (n: number) => {
  const v = Math.ceil(n);
  return `${num(v)} more ${v === 1 ? "leaf" : "leaves"}`;
};

/** "Aqua Guardian badge: +20 leaves for your garden!" */
function badgeLeavesText(list: Garden["new_leaves"]) {
  if (!list.length) return null;
  const total = list.reduce((a, b) => a + b.leaves, 0);
  return list.length === 1
    ? `${list[0].badge} badge: +${leaves(total)} for your garden!`
    : `${list.length} badges won: +${leaves(total)} for your garden!`;
}
const GROUPS: Array<{ label: string; test: (i: GardenItem) => boolean }> = [
  { label: "Plants and flowers", test: (i) => i.cost !== null && (i.kind === "plant" || i.kind === "flower") },
  { label: "Trees", test: (i) => i.cost !== null && i.kind === "tree" },
  { label: "Decorations", test: (i) => i.cost !== null && i.kind === "decor" },
  { label: "Badge rewards", test: (i) => i.cost === null },
];

export function GardenApp({ initial }: { initial: Garden }) {
  const [garden, setGarden] = useState(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [watering, setWatering] = useState<string | null>(null);
  const [grew, setGrew] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<"shop" | "history">("shop");
  const firstLeaves = badgeLeavesText(initial.new_leaves);
  const [toast, setToast] = useState<Toast>(firstLeaves && !initial.new_rewards.length ? { tone: "ok", text: firstLeaves } : null);
  const [celebrate, setCelebrate] = useState<Celebrate>(
    initial.new_rewards.length
      ? {
          item: initial.new_rewards[0].item,
          title: "New badge reward!",
          text: initial.new_rewards.map((r) => `${r.badge} badge: you won a ${r.name}.`).join(" ") + " It's in your garden now." +
            (firstLeaves ? ` ${firstLeaves}` : ""),
        }
      : null,
  );

  const items = useMemo(() => new Map(garden.items.map((i) => [i.code, i])), [garden.items]);
  const byPlot = useMemo(() => new Map(garden.plants.filter((p) => p.plot !== null).map((p) => [p.plot as number, p])), [garden.plants]);
  const shed = garden.plants.filter((p) => p.plot === null);
  const sel = garden.plants.find((p) => p.id === selected) ?? null;
  const mover = garden.plants.find((p) => p.id === moving) ?? null;
  const growing = garden.plants.filter((p) => items.get(p.item)?.grows);
  const grown = growing.filter((p) => p.stage === 3).length;
  const wallet = Math.max(0, garden.available);
  const nextUnlock = garden.items
    .filter((i) => i.cost !== null && i.cost > wallet)
    .sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0))[0];

  useEffect(() => announceLeaves(garden.available), [garden.available]);   // keep the header count in step

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  function apply(res: GardenResult): boolean {
    if (!res.ok) {
      setToast({ tone: "error", text: res.error });
      return false;
    }
    setGarden(res.garden);
    const won = badgeLeavesText(res.garden.new_leaves);
    if (res.garden.new_rewards.length) {
      const r = res.garden.new_rewards[0];
      setCelebrate({ item: r.item, title: "New badge reward!", text: `${r.badge} badge: you won a ${r.name}. It's in your garden now.${won ? ` ${won}` : ""}` });
    } else if (won) {
      setToast({ tone: "ok", text: won });
    }
    return true;
  }

  async function buy(item: GardenItem) {
    if (busy) return;
    setBusy(true);
    const before = new Set(garden.plants.map((p) => p.id));
    const res = await buyItem(item.code);
    setBusy(false);
    if (!apply(res) || !res.ok) return;
    const added = res.garden.plants.find((p) => !before.has(p.id));
    const inShed = added && added.plot === null;
    setCelebrate({
      item: item.code,
      title: item.grows ? `You planted a ${item.name}!` : `You added a ${item.name}!`,
      text: inShed
        ? "Your garden is full, so it's waiting in the shed. Move something to make room."
        : item.grows
          ? "It starts as a seed. Water it once a day and it grows: sprout, young plant, then fully grown."
          : "It's in your garden now. Tap it to move it somewhere else.",
    });
    if (added) setSelected(added.id);
  }

  async function water(p: Plant) {
    if (busy) return;
    setBusy(true);
    setWatering(p.id);
    const [res] = await Promise.all([waterPlant(p.id), sleep(1300)]);
    setWatering(null);
    setBusy(false);
    if (!apply(res) || !res.ok) return;
    if (res.grew) {
      setGrew(p.id);
      const stage = res.garden.plants.find((x) => x.id === p.id)?.stage ?? 0;
      setToast({ tone: "ok", text: `Your ${res.name} grew into ${stage === 3 ? "a fully grown plant" : stage === 2 ? "a young plant" : "a sprout"}!` });
    } else {
      setToast({ tone: "ok", text: `Watered. Your ${res.name} is fully grown and looking happy.` });
    }
  }

  async function moveTo(plot: number) {
    if (!moving || busy) return;
    setBusy(true);
    const res = await movePlant(moving, plot);
    setBusy(false);
    setMoving(null);
    if (apply(res)) setToast({ tone: "ok", text: "Moved." });
  }

  function plotLabel(plot: number, p: Plant | undefined) {
    if (!p) return `Empty spot ${plot + 1}`;
    const it = items.get(p.item);
    return `${it?.name ?? p.item}${it?.grows ? `, ${STAGE_NAMES[p.stage].toLowerCase()}` : ""}`;
  }

  function activate(plot: number, p: Plant | undefined) {
    if (moving) {
      if (p?.id !== moving) void moveTo(plot);
      return;
    }
    if (p) setSelected(p.id === selected ? null : p.id);
    else {
      setSelected(null);
      setPanel("shop");
    }
  }

  const onKey = (plot: number, p: Plant | undefined) => (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate(plot, p);
    }
    if (e.key === "Escape") {
      setMoving(null);
      setSelected(null);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl font-black">Class garden</h1>
          <p className="mt-1 max-w-xl text-stone-600">
            Your class earns leaves for doing its eco jobs. Spend them here. Leaves and points are separate, so spending leaves never touches
            your points or your place on the leaderboard.
          </p>
        </div>
      </div>

      <section aria-label="Leaves" className="grid grid-cols-3 divide-x divide-line rounded-xl border border-line bg-white">
        <div className="px-3 py-3 sm:px-5 sm:py-4">
          <div className="flex items-center gap-2">
            <Icon name="leaf" size={28} className="hidden shrink-0 text-leaf-500 sm:block" />
            <span className="font-display tabular text-3xl font-black sm:text-5xl" aria-live="polite">{num(wallet)}</span>
          </div>
          <div className="text-sm font-semibold text-stone-500 sm:text-base">Leaves to spend</div>
        </div>
        <div className="px-3 py-3 sm:px-5 sm:py-4">
          <div className="font-display tabular text-3xl font-black sm:text-5xl">{num(garden.earned)}</div>
          <div className="text-sm font-semibold text-stone-500 sm:text-base">Leaves earned</div>
        </div>
        <div className="px-3 py-3 sm:px-5 sm:py-4">
          <div className="font-display tabular text-3xl font-black sm:text-5xl">
            {grown}
            <span className="text-xl sm:text-3xl">/{growing.length}</span>
          </div>
          <div className="text-sm font-semibold text-stone-500 sm:text-base">Plants fully grown</div>
        </div>
      </section>

      {nextUnlock && nextUnlock.cost !== null && (
        <div className="flex items-center gap-4 rounded-xl border border-line bg-white px-5 py-3">
          <ItemThumb item={nextUnlock.code} size={48} />
          <div className="min-w-0 flex-1">
            <p>
              <strong>{moreLeaves(nextUnlock.cost - wallet)}</strong> to unlock a {nextUnlock.name}
            </p>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-stone-100" aria-hidden="true">
              <div className="h-full rounded-full bg-leaf-600 transition-[width] duration-700" style={{ width: `${Math.max(2, Math.min(100, (wallet / nextUnlock.cost) * 100))}%` }} />
            </div>
          </div>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-xl border border-line bg-white">
            {mover && (
              <div className="absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 bg-pitch/90 px-4 py-2.5 text-white" role="status">
                <span className="font-bold">Tap a spot to move the {items.get(mover.item)?.name}. Tap a plant to swap them.</span>
                <button type="button" onClick={() => setMoving(null)} className="min-h-10 rounded-lg border border-white/40 px-3 font-bold hover:bg-white/10">
                  Cancel
                </button>
              </div>
            )}
            <svg viewBox={SCENE_VIEWBOX} className="block w-full touch-manipulation select-none" role="group" aria-label={`Class ${garden.class.name}'s garden`}>
              <GardenBackdrop uid="mine" />
              {/* 1. What you see, back row first so nearer plants overlap farther ones */}
              {PLOT_ORDER.map((plot) => {
                const { x, y, s } = plotXY(plot);
                const p = byPlot.get(plot);
                const target = !!moving && p?.id !== moving;
                const ring = p && (p.id === selected || p.id === moving);
                return (
                  <g key={plot} transform={`translate(${x} ${y})`}>
                    <PlotSoil s={s} />
                    {ring && <ellipse cx="0" cy="2" rx={42 * s} ry={13 * s} fill="none" stroke="#ffc233" strokeWidth="4" />}
                    {target && <ellipse cx="0" cy="2" rx={38 * s} ry={11 * s} fill="#ffffff" fillOpacity=".25" stroke="#ffffff" strokeWidth="3" strokeDasharray="6 5" />}
                    {p && (
                      <g transform={`scale(${s})`}>
                        <g key={`${p.id}-${p.stage}`} className={grew === p.id ? "g-grow" : undefined}>
                          <PlantArt item={p.item} stage={p.stage} />
                        </g>
                      </g>
                    )}
                    {watering && p?.id === watering && <WateringCan s={s} />}
                  </g>
                );
              })}
              {/* 2. Tap a plant's body (mouse/touch only; the spot below is the keyboard target) */}
              {PLOT_ORDER.map((plot) => {
                const p = byPlot.get(plot);
                if (!p) return null;
                const { x, y, s } = plotXY(plot);
                return (
                  <rect key={`b${plot}`} aria-hidden="true" onClick={() => activate(plot, p)} className="cursor-pointer"
                    x={x - 46 * s} y={y - 150 * s} width={92 * s} height={140 * s} rx={12} fill="transparent" />
                );
              })}
              {/* 3. Every spot of soil, on top, so tapping a spot always means that spot */}
              {PLOT_ORDER.map((plot) => {
                const { x, y, s } = plotXY(plot);
                const p = byPlot.get(plot);
                const focusable = !!p || !!moving;
                return (
                  <g
                    key={`h${plot}`}
                    role={focusable ? "button" : undefined}
                    tabIndex={focusable ? 0 : undefined}
                    aria-label={focusable ? (moving ? `Move here: ${plotLabel(plot, p)}` : plotLabel(plot, p)) : undefined}
                    aria-pressed={p && !moving ? p.id === selected : undefined}
                    onClick={() => activate(plot, p)}
                    onKeyDown={onKey(plot, p)}
                    className="cursor-pointer outline-none [&:focus-visible>ellipse]:stroke-sun-500"
                  >
                    <ellipse cx={x} cy={y + 2} rx={44 * s} ry={18 * s} fill="transparent" stroke="transparent" strokeWidth="4" />
                  </g>
                );
              })}
            </svg>
          </div>
          <p className="text-stone-500">Tap a plant to see it, water it or move it. Tap an empty spot to open the shop.</p>
          {shed.length > 0 && (
            <section className="rounded-xl border border-sun-500/60 bg-sun-100 p-4" aria-label="Waiting in the shed">
              <h2 className="flex items-center gap-2 font-bold text-sun-700">
                <Icon name="shed" size={20} />
                Waiting in the shed: your garden is full
              </h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {shed.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(null);
                        setMoving(p.id);
                      }}
                      className="flex min-h-12 items-center gap-2 rounded-xl border border-line bg-white py-1 pr-3 pl-1 font-bold hover:border-pitch"
                    >
                      <ItemThumb item={p.item} size={40} />
                      Place the {items.get(p.item)?.name}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <HowToEarn garden={garden} />
        </div>

        <div className="space-y-4">
          {sel ? (
            <PlantCard
              plant={sel}
              item={items.get(sel.item)}
              busy={busy}
              onWater={() => water(sel)}
              onMove={() => {
                setMoving(sel.id);
                setSelected(null);
              }}
              onClose={() => setSelected(null)}
            />
          ) : (
            <section className="rounded-xl border border-line bg-white" aria-label="Shop and history">
              <div role="tablist" aria-label="Garden panel" className="grid grid-cols-2 gap-1 border-b border-line p-1.5">
                {(["shop", "history"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={panel === t}
                    onClick={() => setPanel(t)}
                    className={cx("flex min-h-11 items-center justify-center gap-2 rounded-[10px] font-bold", panel === t ? "bg-pitch text-white" : "text-stone-600 hover:bg-stone-100")}
                  >
                    <Icon name={t === "shop" ? "shop" : "history"} size={18} />
                    {t === "shop" ? "Shop" : "Growth history"}
                  </button>
                ))}
              </div>
              {panel === "shop" ? (
                <div className="space-y-5 p-4 lg:max-h-[38rem] lg:overflow-y-auto" role="tabpanel">
                  {GROUPS.map((g) => {
                    const list = garden.items.filter(g.test);
                    if (!list.length) return null;
                    return (
                      <div key={g.label}>
                        <h2 className="mb-2 font-bold text-stone-500">{g.label}</h2>
                        <ul className="space-y-2">
                          {list.map((it) => (
                            <ShopRow key={it.code} item={it} available={wallet} busy={busy}
                              won={garden.plants.some((p) => p.item === it.code && p.source === "reward")}
                              onBuy={() => buy(it)} />
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 lg:max-h-[38rem] lg:overflow-y-auto" role="tabpanel">
                  {garden.events.length === 0 ? (
                    <p className="text-stone-500">Nothing yet. Plant something from the shop to start your garden&apos;s story.</p>
                  ) : (
                    <ol className="space-y-3">
                      {garden.events.map((e, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className={cx("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                            e.kind === "reward" ? "bg-sun-100 text-sun-700" : e.kind === "grew" ? "bg-lagoon-100 text-lagoon-700"
                              : e.kind === "leaves" ? "bg-team-lime/40 text-leaf-800" : "bg-leaf-100 text-leaf-700")}>
                            <Icon name={e.kind === "reward" ? "medal" : e.kind === "grew" ? "sparkle" : e.kind === "leaves" ? "leaf" : "plant"} size={16} />
                          </span>
                          <span>
                            <span className="block font-semibold">{e.detail}</span>
                            <span className="text-sm text-stone-500">{fmtDay(e.date)}</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      <BadgeShelf badges={garden.badges} />

      {celebrate && <CelebrateDialog c={celebrate} onClose={() => setCelebrate(null)} />}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
        {toast && (
          <p className={cx("g-pop pointer-events-auto flex max-w-md items-start gap-2 rounded-xl px-4 py-3 font-bold shadow-lg",
            toast.tone === "ok" ? "bg-pitch text-white" : "bg-red-700 text-white")}>
            <Icon name={toast.tone === "ok" ? "done" : "warning"} size={20} className="mt-0.5 shrink-0" />
            {toast.text}
          </p>
        )}
      </div>
    </main>
  );
}

/** How leaves are earned, with what this class has earned from each so far. */
function HowToEarn({ garden }: { garden: Garden }) {
  const r = garden.rates;
  const src = garden.sources;
  const tierLeaves = garden.badges.tiers.map((t) => t.leaves).filter((n) => n > 0);
  const rows: Array<{ icon: IconName; label: string; rate: string; got: number; show: boolean }> = [
    { icon: "checklist", label: "Class check", rate: `+${r.class_check} every school day`, got: src.class_checks, show: r.class_check > 0 },
    { icon: "users", label: "Peer check of another class", rate: `+${r.peer_check} each time`, got: src.peer_checks, show: r.peer_check > 0 },
    { icon: "camera", label: "Bin and room photos", rate: `+${r.bin_photo} bin photo, +${r.room_photo} room photo`, got: src.photos, show: r.ai_enabled || src.photos !== 0 },
    { icon: "qr", label: "Eco challenges", rate: "Each one shows its leaves", got: src.challenges, show: true },
    { icon: "medal", label: "Badges", rate: tierLeaves.length ? `+${Math.min(...tierLeaves)} to +${Math.max(...tierLeaves)}, every month` : "Every month", got: src.badges, show: tierLeaves.length > 0 },
    { icon: "star", label: "From your teacher", rate: "For eco drives and extra effort", got: src.teacher, show: src.teacher !== 0 },
  ];
  return (
    <section className="rounded-xl border border-line bg-white p-5" aria-labelledby="earn-title">
      <h2 id="earn-title" className="flex items-center gap-2 text-lg font-bold">
        <Icon name="leaf" size={20} className="text-leaf-500" />
        How your class earns leaves
      </h2>
      <p className="mt-1 text-stone-600">For doing the job, whatever the score. A record your teacher cancels loses its leaves.</p>
      <table className="mt-3 w-full text-[15px]">
        <thead className="sr-only">
          <tr><th>Job</th><th>Leaves your class has earned from it</th></tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.filter((x) => x.show).map((x) => (
            <tr key={x.label}>
              <td className="py-2.5 pr-3">
                <span className="flex items-start gap-3">
                  <Icon name={x.icon} size={20} className="mt-0.5 shrink-0 text-stone-500" />
                  <span>
                    <span className="block font-semibold">{x.label}</span>
                    <span className="text-sm text-stone-500">{x.rate}</span>
                  </span>
                </span>
              </td>
              <td className="py-2.5 text-right whitespace-nowrap">
                <span className="font-display tabular text-2xl font-extrabold">{num(x.got)}</span>
                <span className="sr-only"> leaves so far</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-right text-sm text-stone-500">Leaves earned so far</p>
    </section>
  );
}

function ShopRow({ item, available, busy, won, onBuy }: { item: GardenItem; available: number; busy: boolean; won: boolean; onBuy: () => void }) {
  const can = item.cost !== null && available >= item.cost;
  return (
    <li className="flex items-center gap-3 rounded-xl border border-line p-2 pr-3">
      <span className="rounded-lg bg-leaf-50"><ItemThumb item={item.code} size={56} /></span>
      <div className="min-w-0 flex-1">
        <p className="font-bold">{item.name}</p>
        <p className="text-sm text-stone-500">
          {item.cost !== null ? leaves(item.cost) : `Win it with the ${item.badge} badge`}
          {item.cost !== null && item.badge ? `, or win it with ${item.badge}` : ""}
        </p>
      </div>
      {item.cost !== null ? (
        <button type="button" onClick={onBuy} disabled={!can || busy} className={buttonClass(can ? "primary" : "secondary", "min-w-24 shrink-0")}
          aria-label={can ? `Buy a ${item.name} for ${leaves(item.cost)}` : `${item.name}: need ${moreLeaves(item.cost - available)}`}>
          {can ? "Buy" : (<><Icon name="lock" size={16} />{Math.ceil(item.cost - available)} more</>)}
        </button>
      ) : (
        <span className={cx("inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-sm font-bold", won ? "bg-leaf-100 text-leaf-700" : "bg-stone-100 text-stone-600")}>
          <Icon name={won ? "check" : "lock"} size={14} />
          {won ? "Won" : "Locked"}
        </span>
      )}
    </li>
  );
}

function PlantCard({ plant, item, busy, onWater, onMove, onClose }: {
  plant: Plant; item: GardenItem | undefined; busy: boolean; onWater: () => void; onMove: () => void; onClose: () => void;
}) {
  const grows = !!item?.grows;
  const closeRef = useRef<HTMLButtonElement>(null);
  return (
    <section className="g-pop rounded-xl border border-pitch/40 bg-white p-5" aria-labelledby="plant-title">
      <div className="flex items-start gap-4">
        <span className="rounded-xl bg-leaf-50 p-1">
          <svg viewBox="-80 -175 160 185" width="92" height="106" aria-hidden="true">
            <PlantArt item={plant.item} stage={plant.stage} />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="plant-title" className="font-display text-4xl leading-none font-black">{item?.name ?? plant.item}</h2>
          {grows && <p className="mt-1 font-bold text-leaf-600">{STAGE_NAMES[plant.stage]}</p>}
        </div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-stone-100">
          <Icon name="x" size={20} />
        </button>
      </div>
      {item && <p className="mt-3 text-stone-600">{item.info}</p>}
      {grows && (
        <ol className="mt-4 grid grid-cols-4 gap-1" aria-label="Growth stages">
          {STAGE_NAMES.map((n, i) => (
            <li key={n} className="text-center">
              <span className={cx("block h-2 rounded-full", i <= plant.stage ? "bg-leaf-600" : "bg-stone-100")} />
              <span className={cx("mt-1 block text-xs", i === plant.stage ? "font-bold text-pitch" : "text-stone-500")}>{n}</span>
            </li>
          ))}
        </ol>
      )}
      <dl className="mt-4 grid grid-cols-2 gap-y-2 border-t border-line pt-3 text-[15px]">
        <dt className="text-stone-500">{plant.source === "reward" ? "Won with" : "Unlocked for"}</dt>
        <dd className="text-right font-bold">{plant.source === "reward" ? `${plant.badge} badge` : leaves(plant.cost)}</dd>
        <dt className="text-stone-500">In the garden since</dt>
        <dd className="text-right font-bold">{fmtDay(plant.planted_on)}</dd>
        {grows && (<><dt className="text-stone-500">Times watered</dt><dd className="text-right font-bold">{plant.waterings}</dd></>)}
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        {grows && (
          <button type="button" onClick={onWater} disabled={busy || plant.watered_today} className={buttonClass("primary", "flex-1")}>
            <Icon name="drop" size={18} />
            {plant.watered_today ? "Watered today" : plant.stage < 3 ? "Water it" : "Water it anyway"}
          </button>
        )}
        <button type="button" onClick={onMove} disabled={busy} className={buttonClass("secondary", "flex-1")}>
          <Icon name="move" size={18} />
          Move
        </button>
      </div>
      {grows && plant.watered_today && plant.stage < 3 && <p className="mt-2 text-sm text-stone-500">Come back tomorrow to water it again. It grows one stage each day it&apos;s watered.</p>}
    </section>
  );
}

function WateringCan({ s }: { s: number }) {
  return (
    <g transform={`scale(${s})`} aria-hidden="true">
      <g transform="translate(34 -118)">
        <g className="g-can">
          <rect x="-4" y="-18" width="38" height="28" rx="7" fill="#4da3e8" />
          <path d="M-4 -6 L-32 -22" stroke="#4da3e8" strokeWidth="6" strokeLinecap="round" />
          <path d="M8 -18 C8 -34 30 -34 30 -18" stroke="#2f7fd6" strokeWidth="5" fill="none" />
          <rect x="2" y="-12" width="24" height="5" rx="2.5" fill="#9fd3fb" />
        </g>
      </g>
      <g transform="translate(0 -128)">
        {[0, 1, 2, 3].map((i) => (
          <ellipse key={i} className="g-drop" style={{ animationDelay: `${0.3 + i * 0.16}s` }} cx={-4 + i * 4} cy="0" rx="2.2" ry="3.4" fill="#74c0fc" />
        ))}
      </g>
    </g>
  );
}

function CelebrateDialog({ c, onClose }: { c: NonNullable<Celebrate>; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
      aria-labelledby="celebrate-title"
      className="g-pop m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl bg-white p-0 text-pitch shadow-2xl backdrop:bg-pitch/60"
    >
      <div className="relative overflow-hidden rounded-t-2xl bg-[linear-gradient(#9fd8ff,#e6f6ff)] pt-6">
        <Confetti />
        <ItemThumb item={c.item} size={184} className="g-grow relative mx-auto block" />
        <div className="h-5 bg-[#7cc35a]" />
      </div>
      <div className="p-6 text-center">
        <h2 id="celebrate-title" className="font-display text-4xl leading-tight font-black">{c.title}</h2>
        <p className="mt-2 text-stone-600">{c.text}</p>
        <button type="button" autoFocus onClick={() => ref.current?.close()} className={buttonClass("primary", "mt-5 w-full min-h-12 text-lg")}>
          Back to the garden
        </button>
      </div>
    </dialog>
  );
}

function Confetti() {
  const bits: Array<[number, number, string, IconName | null]> = [
    [12, 20, "#ffc233", null], [30, 8, "#ff7a59", null], [70, 14, "#b794f6", null], [86, 26, "#5fdcc8", null],
    [20, 46, "#b5e354", null], [80, 52, "#ff9cc0", null], [50, 6, "#74c0fc", null],
  ];
  return (
    <div aria-hidden="true">
      {bits.map(([x, y, c], i) => (
        <span key={i} className="g-pop absolute h-2.5 w-2.5 rounded-sm" style={{ left: `${x}%`, top: `${y}%`, background: c, transform: `rotate(${i * 37}deg)`, animationDelay: `${0.1 + i * 0.06}s` }} />
      ))}
    </div>
  );
}
