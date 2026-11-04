"use server";

import { revalidatePath } from "next/cache";
import { aiErrorReason, analyzePhoto } from "@/lib/ai";
import type { AiItem } from "@/lib/ai/normalize";
import { storedResult } from "@/lib/ai/normalize";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMonitor } from "@/lib/session";
import { pts } from "@/lib/format";

export type PhotoState = {
  ok?: boolean;
  error?: string;
  message?: string;
  flagged?: boolean;
  flagReason?: string | null;
  summary?: string;
  items?: AiItem[];
} | null;

const MAX_ATTEMPTS_PER_DAY = 15;
const MAX_BYTES = 2.5 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function runCheck(kind: "bin" | "room", fd: FormData): Promise<PhotoState> {
  const me = await requireMonitor();
  const file = fd.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Take a photo first." };
  if (!TYPES.has(file.type)) return { error: "Please use a normal photo (JPEG, PNG or WebP)." };
  if (file.size > MAX_BYTES) return { error: "That photo is too large. Try again." };

  const admin = createAdminClient();
  // Cost guard: count attempts (including rejected photos) per class per day.
  const { data: attempts, error: aErr } = await admin.rpc("svc_ai_attempts_today", { p_actor: me.user_id });
  if (aErr) return { error: "Couldn't start the check. Try again." };
  if ((attempts ?? 0) >= MAX_ATTEMPTS_PER_DAY) return { error: "Too many photo attempts today. Ask your teacher." };
  await admin.rpc("svc_log", {
    p_school_id: me.school_id, p_actor: me.user_id, p_action: "ai.attempt", p_entity: kind, p_entity_id: null, p_details: { class: me.class_name },
  });

  let analysis;
  try {
    const image = { data: Buffer.from(await file.arrayBuffer()), mime: file.type };
    analysis = kind === "bin" ? await analyzePhoto("bin", image) : await analyzePhoto("room", image);
  } catch (e) {
    console.error("AI photo check failed:", e);
    return { error: `The AI couldn't check that photo: ${aiErrorReason(e)}` };
  }
  const r = analysis.result;
  // The photo is never stored. Reject before anything is saved.
  if (r.people_visible) return { error: "There's a person in the photo. Retake it showing only the " + (kind === "bin" ? "inside of the bin." : "empty room.") };
  if (!r.usable) return { error: `Retake the photo: ${r.unusable_reason || "the AI couldn't read it."}` };

  const { data, error } = await admin.rpc("svc_record_ai_check", {
    p_actor: me.user_id,
    p_check_type: kind,
    p_result: storedResult(kind, r),
    p_provider: analysis.provider,
    p_model: analysis.model,
  });
  if (error) return { error: error.message };
  revalidatePath("/monitor");
  const message =
    kind === "bin"
      ? `AI counted ${"plastic_items" in r ? r.plastic_items : 0} plastic item(s)${data?.baseline ? " (measuring week: no points yet)" : `: ${pts(data?.points)} points`}.`
      : `Room photo checked for ${data?.class}.`;
  return { ok: true, message, flagged: !!data?.flagged, flagReason: data?.flag_reason ?? null, summary: r.summary, items: r.items };
}

export async function runBinCheck(_prev: PhotoState, fd: FormData): Promise<PhotoState> {
  return runCheck("bin", fd);
}

export async function runRoomCheck(_prev: PhotoState, fd: FormData): Promise<PhotoState> {
  return runCheck("room", fd);
}
