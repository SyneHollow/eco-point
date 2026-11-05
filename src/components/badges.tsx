// Monthly badge emblems: hand-drawn SVG, one distinct shape per tier so they read apart
// without colour. No hooks: usable in server and client components.
import type { ReactNode } from "react";
import { cx } from "@/components/ui";

const INK = "#0d3b2e";

type Art = { shape: ReactNode; glyph: ReactNode; ribbon?: boolean };

function star(points: number, outer: number, inner: number) {
  return Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI / points) * i - Math.PI / 2;
    return `${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
}

function art(code: string, on: boolean): Art {
  const f = (color: string, grey = "#d3dcd4") => (on ? color : grey);
  const g = (color: string) => (on ? color : "#9fb0a5");
  switch (code) {
    case "tiny_sprout":
      return {
        shape: (
          <>
            <circle cx="50" cy="50" r="44" fill={f("#b5e354")} stroke={INK} strokeWidth="4" />
            <circle cx="50" cy="50" r="33" fill={f("#ddf5a8", "#e9eee8")} />
          </>
        ),
        glyph: (
          <g fill={g("#2e9e50")}>
            <path d="M50 74 C50 62 50 54 50 46" stroke={g("#3c8d3a")} strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M50 54 C38 54 30 46 31 38 C42 38 49 45 50 54Z" />
            <path d="M50 48 C62 46 69 37 68 30 C57 30 51 38 50 48Z" />
            <path d="M40 76 C44 70 56 70 60 76Z" fill={g("#8b5e3c")} />
          </g>
        ),
      };
    case "green_keeper":
      return {
        shape: (
          <>
            <path d="M50 6 L88 18 C88 52 74 78 50 94 C26 78 12 52 12 18Z" fill={f("#23935a")} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
            <path d="M50 15 L80 24 C80 52 68 72 50 85 C32 72 20 52 20 24Z" fill={f("#5fd18c", "#e9eee8")} />
          </>
        ),
        glyph: (
          <g>
            <path d="M34 66 C30 44 44 28 68 28 C70 52 56 68 34 66Z" fill={g("#0f7a3e")} />
            <path d="M36 64 C44 54 52 46 62 36" stroke={on ? "#c8f2d6" : "#e9eee8"} strokeWidth="3" fill="none" strokeLinecap="round" />
          </g>
        ),
      };
    case "aqua_guardian":
      return {
        shape: (
          <>
            <path d="M50 4 C66 26 86 44 86 62 C86 82 70 95 50 95 C30 95 14 82 14 62 C14 44 34 26 50 4Z" fill={f("#4da3e8")} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
            <path d="M50 16 C63 33 77 48 77 63 C77 78 65 87 50 87 C35 87 23 78 23 63 C23 48 37 33 50 16Z" fill={f("#9fd3fb", "#e9eee8")} />
          </>
        ),
        glyph: (
          <g fill="none" stroke={g("#1f5faf")} strokeWidth="4" strokeLinecap="round">
            <path d="M30 60 C36 54 42 54 48 60 C54 66 60 66 66 60 C68 58 70 57 72 57" />
            <path d="M30 72 C36 66 42 66 48 72 C54 78 60 78 66 72 C68 70 70 69 72 69" />
            <path d="M50 30 C55 37 59 42 59 47 C59 52 55 55 50 55 C45 55 41 52 41 47 C41 42 45 37 50 30Z" fill={g("#1f5faf")} stroke="none" />
          </g>
        ),
      };
    case "earth_protector":
      return {
        shape: (
          <>
            <polygon points="50,4 90,27 90,73 50,96 10,73 10,27" fill={f("#5fdcc8")} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
            <polygon points="50,14 82,32 82,68 50,86 18,68 18,32" fill={f("#c4f3ea", "#e9eee8")} />
          </>
        ),
        glyph: (
          <g>
            <circle cx="50" cy="50" r="22" fill={g("#2f7fd6")} stroke={INK} strokeWidth="3" />
            <path d="M36 42 C42 36 48 40 46 46 C44 52 36 52 34 48Z M52 32 C60 32 68 40 66 46 C62 44 56 46 54 40 C52 36 50 34 52 32Z M48 60 C54 56 62 60 60 68 C54 70 48 66 48 60Z" fill={g("#5dbb63")} />
          </g>
        ),
      };
    case "eco_legend":
      return {
        ribbon: true,
        shape: (
          <>
            <polygon points={star(12, 47, 38)} fill={f("#ffc233")} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
            <circle cx="50" cy="50" r="30" fill={f("#ffe08a", "#e9eee8")} />
          </>
        ),
        glyph: (
          <g fill={g("#7a5a00")}>
            <path d="M30 60 L33 40 L42 50 L50 34 L58 50 L67 40 L70 60Z" />
            <rect x="30" y="61" width="40" height="6" rx="2" />
            <circle cx="50" cy="31" r="3" />
          </g>
        ),
      };
    default: // planet_pioneer
      return {
        ribbon: true,
        shape: (
          <>
            <circle cx="50" cy="50" r="44" fill={f("#3b2f8f")} stroke={INK} strokeWidth="4" />
            <circle cx="50" cy="50" r="35" fill={f("#5b4bc4", "#e9eee8")} />
            {on && [[26, 30], [72, 28], [76, 64], [30, 72], [60, 20]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.8" fill="#fff6c9" />)}
          </>
        ),
        glyph: (
          <g>
            <circle cx="50" cy="50" r="15" fill={g("#5fdcc8")} stroke={INK} strokeWidth="3" />
            <path d="M44 44 C48 42 52 46 50 50 C48 54 42 52 42 48Z" fill={g("#2e9e50")} />
            <ellipse cx="50" cy="50" rx="30" ry="9" fill="none" stroke={g("#ffc233")} strokeWidth="4" transform="rotate(-20 50 50)" />
          </g>
        ),
      };
  }
}

/** One badge emblem. `earned=false` draws a grey, locked version. */
export function BadgeEmblem({ code, earned = true, size = 72, label, className }: { code: string; earned?: boolean; size?: number; label?: string; className?: string }) {
  const a = art(code, earned);
  return (
    <svg
      viewBox="0 0 100 112"
      width={size}
      height={size * 1.12}
      className={cx(className, !earned && "opacity-80")}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {a.ribbon && (
        <g>
          <path d="M30 78 L22 110 L34 102 L42 110 L46 84Z" fill={earned ? "#e5484d" : "#b3c1b7"} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <path d="M70 78 L78 110 L66 102 L58 110 L54 84Z" fill={earned ? "#e5484d" : "#b3c1b7"} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        </g>
      )}
      {a.shape}
      {a.glyph}
      {!earned && (
        <g transform="translate(72 74)">
          <circle r="13" fill="#ffffff" stroke={INK} strokeWidth="3" />
          <rect x="-6" y="-2" width="12" height="9" rx="2" fill={INK} />
          <path d="M-4 -2 v-3 a4 4 0 0 1 8 0 v3" stroke={INK} strokeWidth="2.5" fill="none" />
        </g>
      )}
    </svg>
  );
}
