"use server";

import { revalidatePath } from "next/cache";
import { aiErrorReason, generateJson, generateText } from "@/lib/ai";
import { askContext, classStats } from "@/lib/ai/context";
import { ASK_SYSTEM, CHALLENGE_SYSTEM } from "@/lib/ai/prompts";
import { createClient } from "@/lib/supabase/server";
import { requireTeacher, type ActionState } from "@/lib/session";
import { errorMessage } from "@/lib/format";
import { addDays, isDate, weekStart } from "@/lib/dates";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function reviewAiCheck(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireTeacher();
  const id = str(fd, "id");
  if (!UUID.test(id)) return { error: "Missing check." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_ai_check", { p_id: id, p_note: str(fd, "note") });
  if (error) return { error: errorMessage(error) };
  revalidatePath("/teacher", "layout");
  return { ok: true, message: "Marked as reviewed." };
}

export async function voidAiCheck(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireTeacher();
  const id = str(fd, "id");
  if (!UUID.test(id)) return { error: "Missing check." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_ai_check", { p_id: id, p_reason: str(fd, "reason") });
  if (error) return { error: errorMessage(error) };
  revalidatePath("/teacher", "layout");
  return { ok: true, message: "Voided. Its points and leaves were taken back, and the class can retake the photo today." };
}

export async function saveAiSettings(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireTeacher();
  const max = Number(str(fd, "bin_max_points"));
  const zeroAt = Number(str(fd, "bin_zero_at"));
  if (!(max > 0 && max <= 100)) return { error: "Bin check points must be between 0 and 100." };
  if (!(zeroAt > 0 && zeroAt <= 5)) return { error: "Zero-points level must be between 0 and 5 items per student." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_ai_settings", { p_enabled: fd.get("enabled") === "on", p_bin_max_points: max, p_bin_zero_at: zeroAt });
  if (error) return { error: errorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "AI settings saved." };
}

// ------------------------------------------------------------ Ask EcoPoints ----

export type AskState = { answer?: string; question?: string; error?: string } | null;

export async function askEcoPoints(_p: AskState, fd: FormData): Promise<AskState> {
  const me = await requireTeacher();
  const question = str(fd, "question").slice(0, 500);
  if (question.length < 5) return { error: "Type a question first." };
  try {
    const ctx = await askContext(me);
    const r = await generateText(ASK_SYSTEM, `DATA (JSON):\n${JSON.stringify(ctx)}\n\nTEACHER'S QUESTION: ${question}`);
    return { question, answer: r.text.trim() };
  } catch (e) {
    console.error("Ask EcoPoints failed:", e);
    return { question, error: `The AI couldn't answer: ${aiErrorReason(e)}` };
  }
}

// ------------------------------------------------------- weekly challenges ----

export type ChallengeDraft = { class_id: string; class_name: string; text: string };
export type DraftState = { drafts?: ChallengeDraft[]; error?: string } | null;

export async function draftChallenges(_p: DraftState, _fd?: FormData): Promise<DraftState> {
  const me = await requireTeacher();
  try {
    const supabase = await createClient();
    const { data: classes, error } = await supabase.rpc("teacher_classes");
    if (error) throw error;
    const active = (classes as Array<{ id: string; name: string; active: boolean }>).filter((c) => c.active);
    const { stats } = await classStats(addDays(me.today, -13), me.today);
    const lines = stats.map((s) => {
      const known = Object.entries(s.items).filter(([, v]) => v !== null) as Array<[string, number]>;
      known.sort((a, b) => a[1] - b[1]);
      return {
        class: s.class,
        weakest: known[0] ? `${known[0][0]}: ${known[0][1]}%` : "no data yet",
        strongest: known.at(-1) ? `${known.at(-1)![0]}: ${known.at(-1)![1]}%` : "no data yet",
        bin_plastic_items_per_10_students: s.bin_plastic_per_10,
      };
    });
    const r = await generateJson(CHALLENGE_SYSTEM, `Classes and their last two weeks:\n${JSON.stringify(lines)}`);
    const list = Array.isArray(r.json.challenges) ? (r.json.challenges as Array<{ class?: string; text?: string }>) : [];
    const byName = new Map(list.map((c) => [String(c.class ?? "").toUpperCase(), String(c.text ?? "").slice(0, 200)]));
    return { drafts: active.map((c) => ({ class_id: c.id, class_name: c.name, text: byName.get(c.name.toUpperCase()) ?? "" })) };
  } catch (e) {
    console.error("Challenge drafting failed:", e);
    return { error: `The AI couldn't draft challenges (${aiErrorReason(e)}). You can still type them yourself.` };
  }
}

export async function publishChallenges(_p: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireTeacher();
  const week = str(fd, "week_start") || weekStart(me.today);
  if (!isDate(week)) return { error: "Invalid week." };
  const items: Array<{ class_id: string; text: string }> = [];
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("c_") && UUID.test(k.slice(2))) items.push({ class_id: k.slice(2), text: String(v).trim() });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publish_challenges", { p_week_start: week, p_items: items });
  if (error) return { error: errorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: `Published ${data} challenge(s). They're on the corridor screen and each class's page now.` };
}
