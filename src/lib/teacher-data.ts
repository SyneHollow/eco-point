import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SeriesRow } from "@/lib/types";

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

export type TodayRow = {
  class_id: string;
  class_name: string;
  grade: number;
  strength: number;
  has_monitor: boolean;
  entry_submitted: boolean;
  present: number | null;
  entry_points: number;
  checked: boolean;
  checked_by: string | null;
  checks_class: string | null;
};
export type ClassRow = { id: string; name: string; grade: number; section: string; strength: number; active: boolean; monitor_user_id: string | null };
export type ActionRow = {
  id: string;
  code: string;
  label: string;
  help: string | null;
  input_type: "count" | "check";
  entered_by: "self" | "peer";
  max_points: number;
  sdgs: number[];
  sort_order: number;
  active: boolean;
};
export type EntryRow = {
  id: string;
  entry_date: string;
  class_name: string;
  present: number;
  vals: Record<string, number>;
  points: number;
  baseline: boolean;
  voided: boolean;
  void_reason: string | null;
  submitted_at: string;
};
export type AuditRow = {
  id: string;
  audit_date: string;
  target_name: string;
  auditor_name: string;
  vals: Record<string, number>;
  points: number;
  baseline: boolean;
  voided: boolean;
  void_reason: string | null;
  submitted_at: string;
};
export type LedgerRow = {
  id: number;
  points_date: string;
  class_name: string;
  source: string;
  points: number;
  reason: string | null;
  created_by_name: string | null;
  created_at: string;
};

export const teacherToday = () => call<TodayRow[]>("teacher_today");
export const teacherClasses = () => call<ClassRow[]>("teacher_classes");
export const teacherActions = () => call<ActionRow[]>("teacher_actions");
export const teacherEntries = (from: string, to: string) => call<EntryRow[]>("teacher_entries", { p_from: from, p_to: to });
export const teacherAudits = (from: string, to: string) => call<AuditRow[]>("teacher_peer_audits", { p_from: from, p_to: to });
export const teacherLedger = (from: string, to: string, sources?: string[]) =>
  call<LedgerRow[]>("teacher_ledger", { p_from: from, p_to: to, p_sources: sources ?? null });
export const series = (from: string, to: string, classId?: string) =>
  call<SeriesRow[]>("get_series", { p_from: from, p_to: to, p_class_id: classId ?? null });
export const teacherStaff = () => call<Array<{ id: string; display_name: string; email: string; created_at: string }>>("teacher_staff");
export const activityLog = (limit = 50) =>
  call<Array<{ at: string; actor_name: string | null; action: string; entity: string; details: Record<string, unknown> }>>("teacher_activity_log", {
    p_limit: limit,
  });

export type AiCheckRow = {
  id: string;
  check_type: "bin" | "room";
  check_date: string;
  class_name: string;
  checked_by: string;
  plastic_items: number | null;
  wrong_bin_items: number | null;
  present_used: number | null;
  lights_on: boolean | null;
  litter_level: number | null;
  bin_overflowing: boolean | null;
  confidence: number;
  items: Array<{ label: string; kind: string }>;
  summary: string | null;
  points: number;
  baseline: boolean;
  flagged: boolean;
  flag_reason: string | null;
  reviewed: boolean;
  review_note: string | null;
  voided: boolean;
  void_reason: string | null;
  provider: string;
  model: string;
  created_at: string;
};
export type FlagRow = { kind: "ai_mismatch" | "perfect_streak" | "generous_checker"; class_name: string; detail: string; ref_id: string | null; flag_date: string | null };

export const teacherAiChecks = (from: string, to: string) => call<AiCheckRow[]>("teacher_ai_checks", { p_from: from, p_to: to });
export const teacherFlags = (from: string, to: string) => call<FlagRow[]>("teacher_flags", { p_from: from, p_to: to });

/* ---------------------------------------------------------- rewards ---- */

export type TeacherChallenge = {
  id: string; code: string; title: string; summary: string; steps: string; place: string | null; points: number;
  kind: "instant" | "review"; repeat_every: "day" | "week" | "month" | "once"; token: string; sort: number; active: boolean;
  done_this_month: number; pending: number;
};
export type ClaimRow = {
  id: string; claim_date: string; class_name: string; challenge_title: string; kind: "instant" | "review";
  status: "approved" | "pending" | "rejected" | "voided"; answer: string | null; points: number; submitted_at: string;
  reviewed_by_name: string | null; review_note: string | null;
};
export type GardenSummary = { class_id: string; class_name: string; earned: number; spent: number; available: number; plants: number; grown: number };
export type RewardsConfig = {
  tiers: Array<{ code: string; name: string; tagline: string; threshold: number; reward_name: string | null }>;
  items: Array<{ code: string; name: string; kind: string; cost: number | null; active: boolean }>;
};

export const teacherChallenges = () => call<TeacherChallenge[]>("teacher_challenges");
export const teacherChallengeClaims = (from: string, to: string) => call<ClaimRow[]>("teacher_challenge_claims", { p_from: from, p_to: to });
export const teacherGardens = () => call<GardenSummary[]>("teacher_gardens");
export const rewardsConfig = () => call<RewardsConfig>("teacher_rewards_config");
