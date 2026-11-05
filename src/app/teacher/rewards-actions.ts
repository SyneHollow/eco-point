"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTeacher, type ActionState } from "@/lib/session";
import { errorMessage } from "@/lib/format";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function saveChallenge(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireTeacher();
  const id = str(fd, "id");
  const points = Number(fd.get("points"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_eco_challenge", {
    p_id: UUID.test(id) ? id : null,
    p_title: str(fd, "title"),
    p_summary: str(fd, "summary"),
    p_steps: str(fd, "steps"),
    p_place: str(fd, "place"),
    p_points: Number.isFinite(points) ? points : null,
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
  return { ok: true, message: approve ? "Approved: points added." : "Sent back to the class to try again." };
}

export async function voidClaim(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireTeacher();
  const id = str(fd, "id");
  if (!UUID.test(id)) return { error: "Claim not found." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_challenge_claim", { p_claim: id, p_reason: str(fd, "reason") });
  if (error) return { error: errorMessage(error) };
  revalidatePath("/teacher/challenges");
  return { ok: true, message: "Voided: points taken back." };
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
