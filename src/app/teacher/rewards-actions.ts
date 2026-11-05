"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTeacher, type ActionState } from "@/lib/session";
import { errorMessage, leaves as leafCount } from "@/lib/format";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function saveChallenge(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireTeacher();
  const id = str(fd, "id");
  const points = Number(fd.get("points"));
  const leaves = Number(fd.get("leaves"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_eco_challenge", {
    p_id: UUID.test(id) ? id : null,
    p_title: str(fd, "title"),
    p_summary: str(fd, "summary"),
    p_steps: str(fd, "steps"),
    p_place: str(fd, "place"),
    p_points: Number.isFinite(points) ? points : null,
    p_leaves: Number.isInteger(leaves) ? leaves : null,
    p_kind: str(fd, "kind"),
    p_repeat: str(fd, "repeat_every"),
    p_active: fd.get("active") === "on",
  });
  if (error) return { error: errorMessage(error) };
  revalidatePath("/teacher/challenges");
  return { ok: true, message: id ? "Challenge saved." : "Challenge added. Print its QR code from the button at the top." };
}

export async function reviewClaim(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireTeacher();
  const id = str(fd, "id");
  if (!UUID.test(id)) return { error: "Claim not found." };
  const approve = fd.get("approve") === "1";
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_challenge_claim", { p_claim: id, p_approve: approve, p_note: str(fd, "note") || null });
  if (error) return { error: errorMessage(error) };
  revalidatePath("/teacher/challenges");
  revalidatePath("/teacher");
  return { ok: true, message: approve ? "Approved: points and leaves added." : "Sent back to the class to try again." };
}

export async function voidClaim(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireTeacher();
  const id = str(fd, "id");
  if (!UUID.test(id)) return { error: "Claim not found." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_challenge_claim", { p_claim: id, p_reason: str(fd, "reason") });
  if (error) return { error: errorMessage(error) };
  revalidatePath("/teacher/challenges");
  return { ok: true, message: "Voided: points and leaves taken back." };
}

export async function saveBadgeTier(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireTeacher();
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_badge_tier", { p_code: str(fd, "code"), p_threshold: Number(fd.get("threshold")) });
  if (error) return { error: errorMessage(error) };
  revalidatePath("/teacher/rewards");
  return { ok: true, message: "Saved." };
}

export async function saveGardenItem(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireTeacher();
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_garden_item", {
    p_code: str(fd, "code"),
    p_cost: Number(fd.get("cost")),
    p_active: fd.get("active") === "on",
  });
  if (error) return { error: errorMessage(error) };
  revalidatePath("/teacher/rewards");
  return { ok: true, message: "Saved." };
}

/** Leaves for the class garden (eco drives, extra effort). Minus takes back a mistake. Never touches points. */
export async function giveLeaves(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireTeacher();
  const classId = str(fd, "class_id");
  const n = Number(str(fd, "leaves"));
  if (!UUID.test(classId)) return { error: "Pick a class." };
  if (!Number.isInteger(n) || n === 0) return { error: "Enter a whole number of leaves (not 0)." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("award_leaves", { p_class_id: classId, p_leaves: n, p_reason: str(fd, "reason") });
  if (error) return { error: errorMessage(error) };
  revalidatePath("/teacher/points");
  revalidatePath("/teacher/rewards");
  return { ok: true, message: n > 0 ? `${leafCount(n)} given. The class sees it in its garden history.` : `${leafCount(-n)} taken back.` };
}
