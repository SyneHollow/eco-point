// Garden illustrations: hand-drawn SVG, no external images. No hooks, so these work in
// server components (corridor screen, teacher view) and client components (the monitor's garden).
// Every plant is drawn standing on (0,0) and growing upward (negative y).
import type { ReactNode } from "react";
import { PLOTS } from "@/lib/rewards";

const C = {
  stem: "#3c8d3a", leaf: "#2e9e50", leafDark: "#23853f", leafLight: "#5dbb63", leafPale: "#8bd17c",
  trunk: "#8a5a3b", trunkDark: "#6b4430", soil: "#8b5e3c", soilLight: "#a8774f",
};

function petals(n: number, el: (i: number, a: number) => ReactNode) {
  return Array.from({ length: n }, (_, i) => el(i, (360 / n) * i)).map((x, i) => <g key={i}>{x}</g>);
}

/* ------------------------------------------------------------ grown art ---- */

function Seedling() {
  return (
    <g>
      <path d="M0 0 C1 -12 -1 -26 0 -38" stroke={C.stem} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M0 -18 C-14 -20 -22 -30 -21 -38 C-9 -37 -2 -29 0 -18Z" fill={C.leafLight} />
      <path d="M0 -26 C14 -29 22 -39 20 -46 C8 -45 1 -37 0 -26Z" fill={C.leaf} />
      <path d="M0 -37 C-6 -43 -6 -50 -1 -54 C4 -50 5 -43 0 -37Z" fill={C.leafPale} />
    </g>
  );
}

function Marigold() {
  return (
    <g>
      <path d="M0 0 C2 -20 -2 -38 0 -56" stroke={C.stem} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M0 -16 C-16 -18 -25 -28 -23 -35 C-10 -33 -3 -26 0 -16Z" fill={C.leaf} />
      <path d="M0 -28 C16 -30 25 -40 23 -47 C10 -45 3 -38 0 -28Z" fill={C.leafLight} />
      <g transform="translate(0 -63)">
        {petals(9, (_, a) => <circle cx="0" cy="-10" r="7" fill="#f77f00" transform={`rotate(${a})`} />)}
        {petals(9, (_, a) => <circle cx="0" cy="-6" r="5.5" fill="#ff9f1c" transform={`rotate(${a + 20})`} />)}
        <circle r="5" fill="#ffb703" />
        <circle r="2.4" fill="#c2410c" />
      </g>
    </g>
  );
}

function Sunflower() {
  return (
    <g>
      <path d="M0 0 C3 -30 -3 -70 1 -100" stroke={C.stem} strokeWidth="4.5" fill="none" strokeLinecap="round" />
      <path d="M1 -30 C-20 -30 -32 -44 -30 -54 C-14 -52 -4 -42 1 -30Z" fill={C.leaf} />
      <path d="M0 -55 C20 -56 32 -70 30 -80 C14 -78 4 -68 0 -55Z" fill={C.leafLight} />
      <g transform="translate(1 -106)">
        {petals(14, (i, a) => (
          <ellipse cx="0" cy="-17" rx="5.5" ry="12" fill={i % 2 ? "#ffb000" : "#ffc233"} transform={`rotate(${a})`} />
        ))}
        <circle r="12.5" fill="#6b4226" />
        <circle r="8" fill="#55331d" />
        {[[-4, -3], [3, -5], [5, 2], [-2, 4], [0, 0], [-6, 2], [6, -2]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.3" fill="#3b2313" />
        ))}
      </g>
    </g>
  );
}

function Bush() {
  return (
    <g>
      <circle cx="-26" cy="-22" r="22" fill="#2e8540" />
      <circle cx="26" cy="-23" r="22" fill="#2e8540" />
      <circle cx="0" cy="-36" r="27" fill="#3fa34d" />
      <circle cx="-14" cy="-20" r="17" fill="#3fa34d" />
      <circle cx="14" cy="-18" r="16" fill="#379945" />
      <circle cx="-8" cy="-46" r="10" fill="#6cc26f" opacity=".7" />
      {[[-30, -30], [18, -40], [30, -18], [-6, -18], [6, -54]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.2" fill={i % 2 ? "#ff8fb1" : "#fff4cc"} />
      ))}
    </g>
  );
}

function Neem() {
  return (
    <g>
      <path d="M-8 0 L-5 -70 L5 -70 L8 0Z" fill={C.trunk} />
      <path d="M-1 -60 L-20 -86 M2 -64 L22 -88" stroke={C.trunk} strokeWidth="5" strokeLinecap="round" />
      <path d="M2 0 L4 -66" stroke={C.trunkDark} strokeWidth="2" opacity=".5" />
      <circle cx="-34" cy="-96" r="30" fill="#2e8540" />
      <circle cx="34" cy="-98" r="30" fill="#2e8540" />
      <circle cx="0" cy="-122" r="37" fill="#2e8540" />
      <circle cx="-26" cy="-106" r="24" fill="#3fa34d" />
      <circle cx="22" cy="-112" r="26" fill="#3fa34d" />
      <circle cx="-6" cy="-132" r="24" fill="#3fa34d" />
      <circle cx="-16" cy="-140" r="10" fill="#6cc26f" opacity=".75" />
      <circle cx="18" cy="-124" r="8" fill="#6cc26f" opacity=".6" />
    </g>
  );
}

function DatePalm() {
  const frond = "M0 0 C22 -20 48 -20 70 6 C46 -6 22 -6 0 0Z";
  return (
    <g>
      <path d="M-8 0 C-6 -50 -2 -100 -4 -146 L4 -146 C6 -100 8 -50 8 0Z" fill="#a8763e" />
      {Array.from({ length: 11 }, (_, i) => (
        <path key={i} d={`M-7 ${-8 - i * 12.5} q7 -4 14 0`} stroke="#8a5a2b" strokeWidth="2" fill="none" />
      ))}
      <g transform="translate(0 -146)">
        {[-62, -30, 2].map((a, i) => (
          <path key={`r${i}`} d={frond} fill={i % 2 ? "#3e9b4f" : "#2e7d3c"} transform={`rotate(${a})`} />
        ))}
        {[-62, -30, 2].map((a, i) => (
          <path key={`l${i}`} d={frond} fill={i % 2 ? "#2e7d3c" : "#3e9b4f"} transform={`scale(-1 1) rotate(${a})`} />
        ))}
        <path d={frond} fill="#4caf5e" transform="rotate(-95)" />
        {[[-7, 6], [-3, 9], [-9, 11], [6, 6], [9, 10], [4, 10]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3.2" fill="#c1572b" />
        ))}
      </g>
    </g>
  );
}

function GhafShape({ dark, mid, light, sparkle = false }: { dark: string; mid: string; light: string; sparkle?: boolean }) {
  return (
    <g>
      <path d="M-7 0 C-12 -30 4 -50 -3 -82 L5 -82 C11 -50 -2 -30 9 0Z" fill="#7a5236" />
      <path d="M0 -74 C-14 -86 -30 -92 -46 -96 M2 -76 C16 -88 32 -94 48 -98" stroke="#7a5236" strokeWidth="5" fill="none" strokeLinecap="round" />
      <ellipse cx="0" cy="-110" rx="72" ry="30" fill={dark} />
      {[-58, -38, -18, 2, 22, 42, 58].map((x, i) => (
        <ellipse key={i} cx={x} cy={-86 + (i % 2) * 3} rx="11" ry="9" fill={dark} />
      ))}
      <ellipse cx="-24" cy="-120" rx="38" ry="18" fill={mid} />
      <ellipse cx="28" cy="-118" rx="36" ry="16" fill={mid} />
      <ellipse cx="-10" cy="-132" rx="30" ry="11" fill={light} opacity=".8" />
      {sparkle &&
        [[-44, -136, 1], [38, -140, 0.8], [6, -150, 1.2], [60, -112, 0.7], [-64, -106, 0.8]].map(([x, y, s], i) => (
          <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
            <path className="g-twinkle" style={{ animationDelay: `${i * 0.35}s` }} d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2Z" fill="#fff6c9" />
          </g>
        ))}
    </g>
  );
}

function Sidr() {
  return (
    <g>
      <path d="M-7 0 C-8 -30 -4 -56 -4 -72 L4 -72 C5 -56 8 -30 7 0Z" fill={C.trunkDark} />
      <path d="M0 -62 L-22 -84 M1 -66 L24 -86" stroke={C.trunkDark} strokeWidth="5" strokeLinecap="round" />
      <circle cx="-32" cy="-96" r="28" fill="#2f7d3e" />
      <circle cx="32" cy="-98" r="28" fill="#2f7d3e" />
      <circle cx="0" cy="-116" r="36" fill="#2f7d3e" />
      <circle cx="-14" cy="-110" r="28" fill="#3e9b4f" />
      <circle cx="18" cy="-118" r="22" fill="#3e9b4f" />
      {[[-36, -96], [-12, -126], [26, -104], [6, -96], [38, -90], [-24, -118], [14, -134]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.4" fill="#e8c547" />
      ))}
    </g>
  );
}

function DesertRose() {
  const flower = (x: number, y: number, k: number) => (
    <g key={k} transform={`translate(${x} ${y})`}>
      {petals(5, (_, a) => <ellipse cx="0" cy="-6" rx="4.5" ry="6.5" fill={k % 2 ? "#e84a86" : "#ff6fa5"} transform={`rotate(${a})`} />)}
      <circle r="2.6" fill="#ffe0ec" />
    </g>
  );
  return (
    <g>
      <path d="M-17 0 C-22 -16 -14 -30 -6 -36 L6 -36 C14 -30 22 -16 17 0Z" fill="#c9a27e" />
      <path d="M-6 -6 C-9 -16 -6 -26 -2 -32" stroke="#a9825f" strokeWidth="2.5" fill="none" />
      <path d="M-4 -34 L-16 -54 M2 -35 L4 -60 M5 -34 L18 -50" stroke="#8e6b4e" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="-20" cy="-52" rx="7" ry="3.5" fill={C.leaf} transform="rotate(-30 -20 -52)" />
      <ellipse cx="22" cy="-47" rx="7" ry="3.5" fill={C.leaf} transform="rotate(25 22 -47)" />
      {flower(-16, -58, 0)}
      {flower(4, -66, 1)}
      {flower(19, -55, 2)}
    </g>
  );
}

function Butterfly() {
  return (
    <g transform="translate(0 -58)">
      <g className="g-float">
        <g className="g-flap">
          <path d="M0 -2 C-8 -20 -26 -22 -24 -8 C-23 0 -10 2 0 0Z" fill="#ff7a59" />
          <path d="M0 -2 C8 -20 26 -22 24 -8 C23 0 10 2 0 0Z" fill="#ff7a59" />
          <path d="M0 1 C-6 10 -18 16 -18 6 C-18 0 -8 -1 0 1Z" fill="#b794f6" />
          <path d="M0 1 C6 10 18 16 18 6 C18 0 8 -1 0 1Z" fill="#b794f6" />
          <circle cx="-15" cy="-11" r="3" fill="#fff4cc" />
          <circle cx="15" cy="-11" r="3" fill="#fff4cc" />
        </g>
        <ellipse cx="0" cy="0" rx="2.2" ry="9" fill="#0d3b2e" />
        <path d="M-1 -8 C-3 -14 -6 -16 -8 -17 M1 -8 C3 -14 6 -16 8 -17" stroke="#0d3b2e" strokeWidth="1.2" fill="none" />
      </g>
    </g>
  );
}

function Bulbul() {
  return (
    <g>
      <rect x="-3" y="-30" width="6" height="30" rx="2" fill={C.trunk} />
      <path d="M-18 -30 L18 -30" stroke={C.trunk} strokeWidth="4" strokeLinecap="round" />
      <g className="g-bob">
        <path d="M-14 -38 L-30 -44 L-27 -36Z" fill="#5c4d40" />
        <ellipse cx="-2" cy="-40" rx="15" ry="10" fill="#8a7867" />
        <ellipse cx="-4" cy="-37" rx="10" ry="6" fill="#b3a392" />
        <ellipse cx="-14" cy="-35" rx="4" ry="3" fill="#ffd24d" />
        <circle cx="11" cy="-48" r="8.5" fill="#2b2b2b" />
        <circle cx="13" cy="-46" r="3.4" fill="#ffffff" />
        <circle cx="14" cy="-50" r="1.4" fill="#ffffff" />
        <path d="M19 -49 L25 -47 L19 -45Z" fill="#2b2b2b" />
        <path d="M-2 -31 L-3 -30 M4 -31 L5 -30" stroke="#3b2f25" strokeWidth="2" />
      </g>
    </g>
  );
}

function Bench() {
  return (
    <g>
      <ellipse cx="0" cy="0" rx="44" ry="5" fill="#000" opacity=".12" />
      <rect x="-38" y="-24" width="5" height="24" rx="1.5" fill="#5a3b22" />
      <rect x="33" y="-24" width="5" height="24" rx="1.5" fill="#5a3b22" />
      <rect x="-44" y="-44" width="88" height="6" rx="3" fill="#c68a4c" />
      <rect x="-44" y="-35" width="88" height="6" rx="3" fill="#c68a4c" />
      <rect x="-38" y="-46" width="4" height="22" fill="#5a3b22" />
      <rect x="34" y="-46" width="4" height="22" fill="#5a3b22" />
      <rect x="-46" y="-26" width="92" height="7" rx="3" fill="#b5793f" />
    </g>
  );
}

function LotusPond() {
  return (
    <g>
      <ellipse cx="0" cy="-8" rx="60" ry="17" fill="#c8b89a" />
      <ellipse cx="0" cy="-9" rx="54" ry="14" fill="#4da3e8" />
      <ellipse cx="4" cy="-10" rx="44" ry="10" fill="#74c0fc" />
      <ellipse className="g-ripple" cx="10" cy="-9" rx="12" ry="4" fill="none" stroke="#e3f2ff" strokeWidth="1.5" />
      <ellipse cx="22" cy="-6" rx="11" ry="4.5" fill="#3fa34d" />
      <ellipse cx="-30" cy="-11" rx="10" ry="4" fill="#3fa34d" />
      <g transform="translate(-20 -12)">
        <ellipse cx="-6" cy="-4" rx="4" ry="8" fill="#ff8fb1" transform="rotate(-30 -6 -4)" />
        <ellipse cx="6" cy="-4" rx="4" ry="8" fill="#ff8fb1" transform="rotate(30 6 -4)" />
        <ellipse cx="0" cy="-7" rx="4.2" ry="9" fill="#ffb3c8" />
        <circle cx="0" cy="-1" r="2" fill="#ffd966" />
      </g>
    </g>
  );
}

const ART: Record<string, () => ReactNode> = {
  seedling: Seedling,
  marigold: Marigold,
  sunflower: Sunflower,
  bush: Bush,
  neem: Neem,
  date_palm: DatePalm,
  ghaf: () => <GhafShape dark="#6e9f4f" mid="#8db86b" light="#b5d68f" />,
  golden_ghaf: () => <GhafShape dark="#e0a100" mid="#ffc233" light="#ffe08a" sparkle />,
  sidr: Sidr,
  desert_rose: DesertRose,
  butterfly: Butterfly,
  bulbul: Bulbul,
  bench: Bench,
  lotus_pond: LotusPond,
};

/** Box (width, height) each item needs when fully grown, for thumbnails. */
const BOX: Record<string, [number, number]> = {
  seedling: [50, 58], marigold: [56, 80], sunflower: [70, 130], bush: [104, 66], neem: [134, 162],
  date_palm: [150, 200], ghaf: [158, 160], golden_ghaf: [158, 165], sidr: [132, 154], desert_rose: [62, 80],
  butterfly: [56, 84], bulbul: [62, 62], bench: [96, 50], lotus_pond: [126, 32],
};

function SeedMound() {
  return (
    <g>
      <path d="M-15 0 C-11 -9 11 -9 15 0Z" fill={C.soilLight} />
      <ellipse cx="1" cy="-6" rx="4" ry="2.8" fill="#e9d3a8" transform="rotate(-20 1 -6)" />
    </g>
  );
}

function Sprout() {
  return (
    <g>
      <path d="M-11 0 C-8 -6 8 -6 11 0Z" fill={C.soilLight} />
      <path d="M0 -3 C0 -10 1 -16 0 -22" stroke={C.stem} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M0 -16 C-10 -17 -15 -24 -13 -29 C-6 -28 -1 -23 0 -16Z" fill={C.leafLight} />
      <path d="M0 -19 C10 -21 15 -28 13 -32 C6 -31 1 -26 0 -19Z" fill={C.leaf} />
    </g>
  );
}

/** One garden item at a growth stage. Decorations ignore the stage. */
export function PlantArt({ item, stage = 3 }: { item: string; stage?: number }) {
  const Art = ART[item] ?? Seedling;
  const decor = item === "butterfly" || item === "bulbul" || item === "bench" || item === "lotus_pond";
  if (decor || stage >= 3) return <Art />;
  if (stage <= 0) return <SeedMound />;
  if (stage === 1) return <Sprout />;
  return (
    <g transform="scale(0.58)">
      <Art />
    </g>
  );
}

/** Small standalone picture of an item, fully grown (shop, rewards, teacher pages). */
export function ItemThumb({ item, size = 64, className }: { item: string; size?: number; className?: string }) {
  const [w, h] = BOX[item] ?? [60, 60];
  const pad = 6;
  const side = Math.max(w, h) + pad * 2;
  return (
    <svg viewBox={`${-side / 2} ${-side + pad} ${side} ${side}`} width={size} height={size} className={className} aria-hidden="true" focusable="false">
      <PlantArt item={item} />
    </svg>
  );
}

/* ---------------------------------------------------------- the scene ---- */

export const SCENE_W = 720;
export const SCENE_TOP = 120; // the scene is cropped: sky above this isn't shown
export const SCENE_H = 420;
export const SCENE_VIEWBOX = `0 ${SCENE_TOP} ${SCENE_W} ${SCENE_H}`;
const ROWS = [
  { y: 506, s: 1, x0: 72, step: 115 }, // front: plots 0–5
  { y: 428, s: 0.82, x0: 106, step: 101.6 }, // middle: plots 6–11
  { y: 358, s: 0.66, x0: 140, step: 88 }, // back: plots 12–17
];

export function plotXY(plot: number) {
  const r = ROWS[Math.floor(plot / 6)] ?? ROWS[0];
  return { x: r.x0 + (plot % 6) * r.step, y: r.y, s: r.s };
}

/** Plots in drawing order: back row first, so nearer plants overlap farther ones. */
export const PLOT_ORDER = Array.from({ length: PLOTS }, (_, i) => i).sort((a, b) => Math.floor(b / 6) - Math.floor(a / 6) || a - b);

export function PlotSoil({ s }: { s: number }) {
  return (
    <g transform={`scale(${s})`}>
      <ellipse cx="0" cy="2" rx="34" ry="9" fill={C.soil} />
      <ellipse cx="0" cy="0" rx="30" ry="6.5" fill={C.soilLight} opacity=".55" />
    </g>
  );
}

/** Sky, sun, clouds, hills, fence and grass. `uid` keeps gradient ids unique when several gardens share a page. */
export function GardenBackdrop({ uid, still = false }: { uid: string; still?: boolean }) {
  const tufts = [[40, 470], [160, 452], [300, 476], [430, 458], [560, 474], [680, 452], [240, 390], [470, 384], [620, 392], [90, 396], [360, 520], [520, 530]];
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7cc4fa" />
          <stop offset="1" stopColor="#e2f4ff" />
        </linearGradient>
        <linearGradient id={`${uid}-grass`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#97d672" />
          <stop offset="1" stopColor="#5aac3c" />
        </linearGradient>
      </defs>
      <rect y={SCENE_TOP} width={SCENE_W} height={SCENE_H} fill={`url(#${uid}-sky)`} />
      <g transform="translate(640 176) scale(.8)">
        <g className={still ? undefined : "g-spin"}>
          {Array.from({ length: 12 }, (_, i) => (
            <rect key={i} x="-2.5" y="-58" width="5" height="14" rx="2.5" fill="#ffe58f" transform={`rotate(${i * 30})`} />
          ))}
        </g>
        <circle r="36" fill="#ffd966" />
        <circle r="27" fill="#ffe58f" />
      </g>
      <g className={still ? undefined : "g-drift"}>
        <g transform="translate(110 168) scale(.85)" fill="#ffffff" opacity=".92">
          <circle cx="0" cy="0" r="20" /><circle cx="24" cy="-8" r="26" /><circle cx="52" cy="2" r="18" /><rect x="0" y="0" width="54" height="18" rx="9" />
        </g>
        <g transform="translate(390 146) scale(.6)" fill="#ffffff" opacity=".85">
          <circle cx="0" cy="0" r="20" /><circle cx="24" cy="-8" r="26" /><circle cx="52" cy="2" r="18" /><rect x="0" y="0" width="54" height="18" rx="9" />
        </g>
      </g>
      <path d="M0 292 C120 236 250 250 360 276 C480 304 600 236 720 262 L720 372 L0 372Z" fill="#addc82" />
      <path d="M0 318 C150 284 300 314 420 300 C540 286 640 306 720 296 L720 380 L0 380Z" fill="#8ccb62" />
      <g opacity=".9">
        <rect x="96" y="318" width="528" height="4" rx="2" fill="#efe3c8" />
        <rect x="96" y="330" width="528" height="4" rx="2" fill="#efe3c8" />
        {Array.from({ length: 23 }, (_, i) => (
          <path key={i} d={`M${100 + i * 23.5} 342 v-30 l3 -5 l3 5 v30z`} fill="#f7efdc" />
        ))}
      </g>
      <path d="M0 344 C200 324 520 324 720 344 L720 540 L0 540Z" fill={`url(#${uid}-grass)`} />
      {tufts.map(([x, y], i) => (
        <path key={i} d={`M${x} ${y} l-4 -9 M${x} ${y} l0 -11 M${x} ${y} l4 -9`} stroke="#4c9a33" strokeWidth="2" strokeLinecap="round" />
      ))}
      {[[200, 470], [410, 500], [600, 488], [60, 520], [690, 520]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <circle r="3" fill={i % 2 ? "#ffffff" : "#ffe58f"} />
          <circle r="1.2" fill="#f2a900" />
        </g>
      ))}
    </g>
  );
}

/**
 * A whole garden, not interactive (Today page, corridor screen, teacher pages). Previews crop
 * close to the garden and leave out empty soil spots, so a young garden still reads as a meadow.
 */
export function GardenScene({
  uid,
  plants,
  className,
  still = false,
  label,
  showEmpty = false,
}: {
  uid: string;
  plants: Array<{ item: string; plot: number | null; stage: number }>;
  className?: string;
  still?: boolean;
  label?: string;
  showEmpty?: boolean;
}) {
  const byPlot = new Map(plants.filter((p) => p.plot !== null).map((p) => [p.plot as number, p]));
  const viewBox = showEmpty ? SCENE_VIEWBOX : `30 196 ${SCENE_W - 60} ${SCENE_TOP + SCENE_H - 196}`;
  return (
    <svg viewBox={viewBox} className={className} role="img" aria-label={label ?? "Class garden"}>
      <GardenBackdrop uid={uid} still={still} />
      {PLOT_ORDER.map((plot) => {
        const { x, y, s } = plotXY(plot);
        const p = byPlot.get(plot);
        if (!p && !showEmpty) return null;
        return (
          <g key={plot} transform={`translate(${x} ${y})`}>
            <PlotSoil s={s} />
            {p && (
              <g transform={`scale(${s})`}>
                <PlantArt item={p.item} stage={p.stage} />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
