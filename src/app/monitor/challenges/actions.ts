"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMonitor, type ActionState } from "@/lib/session";
import { errorMessage, leaves, pts } from "@/lib/format";

export async function claimChallenge(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireMonitor();
  const token = String(fd.get("token") ?? "").toLowerCase();
  const answer = String(fd.get("answer") ?? "").trim();
  if (!/^[a-z0-9]{10}$/.test(token)) return { error: "This QR code isn't an active eco challenge." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_challenge", { p_token: token, p_answer: answer || null });
  if (error) return { error: errorMessage(error) };
  revalidatePath("/monitor", "layout");
  return data?.status === "approved"
    ? { ok: true, message: `Done! Your class earned ${pts(data.points)} points${data.leaves > 0 ? ` and ${leaves(data.leaves)}` : ""}.` }
    : { ok: true, message: "Sent to your teacher. The points and leaves arrive when they approve it." };
}
