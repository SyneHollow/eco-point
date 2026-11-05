export function pts(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  return Number.isInteger(v) ? v.toLocaleString("en-GB") : v.toLocaleString("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function num(n: number | string | null | undefined) {
  return Number(n ?? 0).toLocaleString("en-GB", { maximumFractionDigits: 0 });
}

export function pct(n: number | string | null | undefined) {
  if (n === null || n === undefined) return "–";
  return `${Number(n).toLocaleString("en-GB", { maximumFractionDigits: 0 })}%`;
}

export function errorMessage(e: { message?: string } | null | undefined, fallback = "Something went wrong. Please try again.") {
  const m = e?.message?.trim();
  if (!m) return fallback;
  if (/permission denied|jwt|not authorized/i.test(m)) return "You're not allowed to do that. Try logging in again.";
  return m;
}

/** "1 bin photo", "3 bin photos" */
export function plural(n: number | string | null | undefined, word: string, many = `${word}s`) {
  const v = Number(n ?? 0);
  return `${num(v)} ${v === 1 ? word : many}`;
}

/** "1 leaf", "15 leaves" (the garden currency; always whole numbers) */
export function leaves(n: number | string | null | undefined) {
  const v = Math.round(Number(n ?? 0));
  return `${num(v)} ${Math.abs(v) === 1 ? "leaf" : "leaves"}`;
}
