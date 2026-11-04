import "server-only";
import { createClient } from "@/lib/supabase/server";
import { SCHOOL_SLUG } from "@/lib/config";
import { addDays, periodRange } from "@/lib/dates";
import type { Me } from "@/lib/session";
import type { Impact, LeaderRow } from "@/lib/types";

// Builds a compact, numbers-only summary of the school's data for the AI.
// Only class-level figures: no student data exists to send.

type Entry = { class_name: string; present: number; vals: Record<string, number>; voided: boolean; baseline: boolean };
type Audit = { target_name: string; vals: Record<string, number>; voided: boolean };
type AiCheck = { class_name: string; check_type: string; plastic_items: number | null; present_used: number | null; voided: boolean };
type Action = { code: string; label: string; input_type: "count" | "check"; entered_by: "self" | "peer"; active: boolean };

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

const round = (n: number) => Math.round(n * 10) / 10;

export type ClassStat = { class: string; days_submitted: number; items: Record<string, number | null>; bin_plastic_per_10: number | null };

export async function classStats(from: string, to: string): Promise<{ stats: ClassStat[]; actions: Action[] }> {
  const [entries, audits, checks, actions, classes] = await Promise.all([
    rpc<Entry[]>("teacher_entries", { p_from: from, p_to: to }),
    rpc<Audit[]>("teacher_peer_audits", { p_from: from, p_to: to }),
    rpc<AiCheck[]>("teacher_ai_checks", { p_from: from, p_to: to }),
    rpc<Action[]>("teacher_actions"),
    rpc<Array<{ name: string; active: boolean }>>("teacher_classes"),
  ]);
  const active = actions.filter((a) => a.active);
  const stats: ClassStat[] = classes
    .filter((c) => c.active)
    .map((c) => {
      const es = entries.filter((e) => e.class_name === c.name && !e.voided);
      const as = audits.filter((a) => a.target_name === c.name && !a.voided);
      const bins = checks.filter((k) => k.class_name === c.name && k.check_type === "bin" && !k.voided);
      const items: Record<string, number | null> = {};
      for (const a of active) {
        if (a.entered_by === "self" && a.input_type === "count") {
          const num = es.reduce((s, e) => s + (e.vals[a.code] ?? 0), 0);
          const den = es.reduce((s, e) => s + (a.code in e.vals ? e.present : 0), 0);
          items[`${a.label} (% of students)`] = den ? round((100 * num) / den) : null;
        } else {
          const src = a.entered_by === "peer" ? as : es;
          const vals = src.map((x) => x.vals[a.code]).filter((v) => v !== undefined);
          items[`${a.label} (% of checks yes)`] = vals.length ? round((100 * vals.reduce((s, v) => s + v, 0)) / vals.length) : null;
        }
      }
      const binItems = bins.reduce((s, k) => s + (k.plastic_items ?? 0), 0);
      const binStudents = bins.reduce((s, k) => s + (k.present_used ?? 0), 0);
      return { class: c.name, days_submitted: es.length, items, bin_plastic_per_10: binStudents ? round((10 * binItems) / binStudents) : null };
    });
  return { stats, actions: active };
}

export async function askContext(me: Me) {
  const month = periodRange("month", me.today);
  const last = periodRange("last-month", me.today);
  const from28 = addDays(me.today, -27);
  const [lbMonth, lbLast, impMonth, impLast, aiMonth, aiLast, flags, recent] = await Promise.all([
    rpc<LeaderRow[]>("get_leaderboard", { p_slug: SCHOOL_SLUG, p_from: month.from, p_to: month.to }),
    rpc<LeaderRow[]>("get_leaderboard", { p_slug: SCHOOL_SLUG, p_from: last.from, p_to: last.to }),
    rpc<Impact>("get_impact", { p_slug: SCHOOL_SLUG, p_from: month.from, p_to: month.to }),
    rpc<Impact>("get_impact", { p_slug: SCHOOL_SLUG, p_from: last.from, p_to: last.to }),
    rpc<Record<string, unknown>>("get_ai_summary", { p_slug: SCHOOL_SLUG, p_from: month.from, p_to: month.to }),
    rpc<Record<string, unknown>>("get_ai_summary", { p_slug: SCHOOL_SLUG, p_from: last.from, p_to: last.to }),
    rpc<Array<{ kind: string; detail: string }>>("teacher_flags", { p_from: from28, p_to: me.today }),
    classStats(from28, me.today),
  ]);
  const board = (rows: LeaderRow[]) => rows.map((r) => ({ class: r.class_name, rank: r.rank, points: Number(r.points), days_submitted: r.days_submitted }));
  const impact = (i: Impact) => ({
    class_checks: i.entries,
    peer_checks: i.audits,
    items: i.items.map((it) => ({ item: it.label, result_pct: it.pct, total: it.total })),
  });
  return {
    school: me.school_name,
    today: me.today,
    points_started: me.points_start_date,
    this_month: { from: month.from, to: month.to, leaderboard: board(lbMonth), habits: impact(impMonth), ai_bin_checks: aiMonth },
    last_month: { from: last.from, to: last.to, leaderboard: board(lbLast), habits: impact(impLast), ai_bin_checks: aiLast },
    last_28_days_by_class: recent.stats,
    open_flags: flags.map((f) => f.detail),
  };
}
