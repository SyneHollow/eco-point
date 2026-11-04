// Turns whatever the AI model replied into a strict, safe shape.
// Self-contained (no imports) so it can be unit-tested on its own.

export type Box = [number, number, number, number]; // [ymin, xmin, ymax, xmax], 0–1000
export type AiItem = { label: string; kind: "plastic" | "wrong_bin" | "litter" | "light"; box?: Box };

type Common = {
  usable: boolean;
  unusable_reason: string;
  people_visible: boolean;
  confidence: number;
  summary: string;
  items: AiItem[];
};
export type BinResult = Common & { plastic_items: number; wrong_bin_items: number };
export type RoomResult = Common & { lights_on: boolean; litter_level: 0 | 1 | 2 | 3; bin_overflowing: boolean };

/** Pull the first JSON object out of a reply (handles ```json fences and stray text). */
export function extractJson(text: string): Record<string, unknown> {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const v = JSON.parse(trimmed);
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* fall through */
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const v = JSON.parse(trimmed.slice(start, end + 1));
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  }
  throw new Error("The AI reply wasn't valid JSON");
}

const bool = (v: unknown, fallback = false) => (typeof v === "boolean" ? v : v === "true" ? true : v === "false" ? false : fallback);
const int = (v: unknown, min: number, max: number) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, Math.round(n)));
};
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

function box(v: unknown): Box | undefined {
  if (!Array.isArray(v) || v.length !== 4) return undefined;
  const n = v.map((x) => int(x, 0, 1000));
  if (n.some((x) => x === null)) return undefined;
  const [y1, x1, y2, x2] = n as number[];
  if (y2 <= y1 || x2 <= x1) return undefined;
  return [y1, x1, y2, x2];
}

function items(v: unknown, allowed: AiItem["kind"][]): AiItem[] {
  if (!Array.isArray(v)) return [];
  const out: AiItem[] = [];
  for (const raw of v.slice(0, 200)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const kind = allowed.includes(r.kind as AiItem["kind"]) ? (r.kind as AiItem["kind"]) : allowed[0];
    out.push({ label: text(r.label, 40) || kind, kind, box: box(r.box_2d ?? r.box) });
  }
  return out;
}

function common(j: Record<string, unknown>, kinds: AiItem["kind"][]): Common {
  const confidence = typeof j.confidence === "number" ? Math.min(1, Math.max(0, j.confidence)) : 0.5;
  return {
    usable: bool(j.usable, true),
    unusable_reason: text(j.unusable_reason, 200),
    people_visible: bool(j.people_visible, false),
    confidence: Math.round(confidence * 100) / 100,
    summary: text(j.summary, 300),
    items: items(j.items, kinds),
  };
}

export function normalizeBin(j: Record<string, unknown>): BinResult {
  const c = common(j, ["plastic", "wrong_bin"]);
  const plastic = int(j.plastic_items, 0, 500);
  const wrong = int(j.wrong_bin_items, 0, 500) ?? 0;
  if (plastic === null) {
    // No count at all → treat as unusable rather than guessing.
    return { ...c, usable: false, unusable_reason: c.unusable_reason || "The AI couldn't count the items", plastic_items: 0, wrong_bin_items: 0 };
  }
  return { ...c, plastic_items: plastic, wrong_bin_items: wrong };
}

export function normalizeRoom(j: Record<string, unknown>): RoomResult {
  const c = common(j, ["litter", "light"]);
  const litter = int(j.litter_level, 0, 3);
  if (typeof j.lights_on !== "boolean" && j.lights_on !== "true" && j.lights_on !== "false") {
    return { ...c, usable: false, unusable_reason: c.unusable_reason || "The AI couldn't tell if the lights were on", lights_on: false, litter_level: 0, bin_overflowing: false };
  }
  return { ...c, lights_on: bool(j.lights_on), litter_level: (litter ?? 0) as 0 | 1 | 2 | 3, bin_overflowing: bool(j.bin_overflowing) };
}

/** What gets stored in the database: no boxes, no image. */
export function storedResult(kind: "bin" | "room", r: BinResult | RoomResult) {
  const base = { confidence: r.confidence, summary: r.summary, items: r.items.map(({ label, kind }) => ({ label, kind })) };
  return kind === "bin"
    ? { ...base, plastic_items: (r as BinResult).plastic_items, wrong_bin_items: (r as BinResult).wrong_bin_items }
    : { ...base, lights_on: (r as RoomResult).lights_on, litter_level: (r as RoomResult).litter_level, bin_overflowing: (r as RoomResult).bin_overflowing };
}
