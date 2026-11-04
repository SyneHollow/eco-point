# EcoPoints: design rules ("match day")

EcoPoints is a league between classes, so it looks like one: each class is a team with its own colour, standings read like a scoreboard, and a monitor's daily check reads like a match card. Read this before changing any screen.

## Tokens (`src/app/globals.css`)
| Token | Hex | Use |
|---|---|---|
| `pitch` (= `leaf-900`, `ink`) | `#0d3b2e` | All text, dark bands, primary buttons, TV background |
| `chalk` (= `paper`) | `#eef2ed` | Page background |
| `line` | `#d3dcd4` | Panel borders and dividers |
| `leaf-600` | `#177245` | Success, links, "Yes" |
| `sun-500` | `#ffc233` | **1st place and the leader only** (medal, leader bar, progress on dark), focus ring on dark |
| `red-700` | `#b91c1c` | Errors, "No", destructive |
| `lagoon-*` | `#1f5faf` on `#e3eefb` | AI output and information |
| Team colours | lime `#b5e354` · aqua `#5fdcc8` · sky `#74c0fc` · peri `#a5b4fc` · lilac `#d0a6f8` · rose `#ff9cc0` · coral `#ff9e80` · butter `#ffd966` | One per class, always with `pitch` text (6.2:1 or better) |

`stone-*` is remapped to cool green-greys; `stone-500` is the muted text colour (5.7:1 on chalk). Every text pair passes WCAG AA; checked 4 Nov 2026.

## Type
- **Big Shoulders Display** (`font-display`, 800–900): page titles (`text-5xl`+), scores, ranks, class codes, big numbers. Never below 24px; it's condensed and gets hard to read small.
- **Atkinson Hyperlegible Next** (everything else, 16px base): designed by the Braille Institute so I/l/1 and 0/O differ. Panel titles are plain bold `text-lg`, not the display face.
- Both are self-hosted npm packages (`@fontsource-variable/*`), imported in `src/app/layout.tsx`. No Google Fonts request.

## Components (`src/components/ui.tsx`, `icons.tsx`, `leaderboard.tsx`)
- `TeamTile` ("bib"): a class code on its team colour. Use it wherever a class is named in a list or table. Colour comes from `teamColor(name)`.
- `Medal`: SVG medal for ranks 1–3, a plain numeral after that.
- `Card`: white panel, 1px `line` border, **no shadow**, 12px radius. Controls are 10px radius, chips are pills: radius follows hierarchy.
- `Icon`: the only icon source (Phosphor, bold). Decorative by default; pass `label` when the icon carries meaning alone.
- `Podium` / `LeaderList`: the standings. The podium stands on the bottom edge of a `pitch` band (home, leaderboard).
- Buttons (`buttonClass`): ≥ 44px tall; primary has a darker bottom edge and moves 1px when pressed. Variants: `primary`, `secondary`, `light` (on dark), `ghostDark`, `sun`, `danger`.
- Inputs (`inputClass`): 16px text (phones don't zoom), 1.5px border at 4.9:1.

## Rules
- **No emoji, no "→", no " · " joiners, no ALL-CAPS labels, no soft grey shadows.** These made v1 look generated.
- Gold means first place. Don't use it for decoration or general buttons.
- Numbered markers only for real sequences (the monitor's steps are one).
- One motion moment: the podium rising on load. Everything else is feedback to a tap. `prefers-reduced-motion` turns animations off (globals.css).
- Every dark surface gets `className="on-dark"` so the focus ring turns gold.
- Monitor screens: big targets (56px steppers and Yes/No), one job per panel, plain words a 12-year-old understands.
- TV (`/display`): must fit 1920×1080 with no scrolling; the page is locked to the screen height.
- Before shipping UI: check a 390px-wide phone for sideways scrolling (the harness screenshot script fails on it).
