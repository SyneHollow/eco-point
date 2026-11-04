import "server-only";
import { createPublicClient } from "@/lib/supabase/server";
import { SCHOOL_SLUG } from "@/lib/config";
import type { AiSummary, Champion, Impact, LeaderRow, School } from "@/lib/types";

// Public (no login) reads. Each RPC returns aggregates only.

export async function getSchool(): Promise<School | null> {
  const { data, error } = await createPublicClient().rpc("public_school", { p_slug: SCHOOL_SLUG });
  if (error) throw new Error(`public_school: ${error.message}`);
  return (data as School) ?? null;
}

export async function getClasses(): Promise<Array<{ id: string; name: string; grade: number; section: string }>> {
  const { data, error } = await createPublicClient().rpc("public_classes", { p_slug: SCHOOL_SLUG });
  if (error) throw new Error(`public_classes: ${error.message}`);
  return data ?? [];
}

export async function getLeaderboard(from: string, to: string): Promise<LeaderRow[]> {
  const { data, error } = await createPublicClient().rpc("get_leaderboard", { p_slug: SCHOOL_SLUG, p_from: from, p_to: to });
  if (error) throw new Error(`get_leaderboard: ${error.message}`);
  return (data ?? []).map((r: LeaderRow) => ({ ...r, points: Number(r.points) }));
}

export async function getImpact(from: string, to: string): Promise<Impact | null> {
  const { data, error } = await createPublicClient().rpc("get_impact", { p_slug: SCHOOL_SLUG, p_from: from, p_to: to });
  if (error) throw new Error(`get_impact: ${error.message}`);
  return (data as Impact) ?? null;
}

export async function getChampions(): Promise<Champion[]> {
  const { data, error } = await createPublicClient().rpc("get_champions", { p_slug: SCHOOL_SLUG });
  if (error) throw new Error(`get_champions: ${error.message}`);
  return data ?? [];
}

/** Re-rank after filtering to one grade. */
export function rerank(rows: LeaderRow[]): LeaderRow[] {
  const sorted = [...rows].sort((a, b) => b.points - a.points || a.class_name.localeCompare(b.class_name, "en", { numeric: true }));
  let lastPts: number | null = null;
  let lastRank = 0;
  return sorted.map((r, i) => {
    const rank = lastPts !== null && r.points === lastPts ? lastRank : i + 1;
    lastPts = r.points;
    lastRank = rank;
    return { ...r, rank };
  });
}

export async function getAiSummary(from: string, to: string): Promise<AiSummary | null> {
  const { data, error } = await createPublicClient().rpc("get_ai_summary", { p_slug: SCHOOL_SLUG, p_from: from, p_to: to });
  if (error) throw new Error(`get_ai_summary: ${error.message}`);
  return (data as AiSummary) ?? null;
}

export async function getChallenges(weekStart: string): Promise<Array<{ class_id: string; class_name: string; text: string }>> {
  const { data, error } = await createPublicClient().rpc("get_challenges", { p_slug: SCHOOL_SLUG, p_week_start: weekStart });
  if (error) throw new Error(`get_challenges: ${error.message}`);
  return data ?? [];
}
