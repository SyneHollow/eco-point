/** Where to go after a monitor logs in: only our own QR-code and monitor pages, never another site. */
export function safeNext(raw: unknown): string | null {
  const s = String(raw ?? "");
  return /^\/(c\/[a-z0-9]{10}|monitor(\/(garden|challenges(\/[a-z0-9]{10})?))?)$/.test(s) ? s : null;
}
