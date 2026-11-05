"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMonitor, type ActionState } from "@/lib/session";
import { errorMessage, pts } from "@/lib/format";

function parseValues(raw: FormDataEntryValue | null): Record<string, number> | null {
  try {
    const v = JSON.parse(String(raw ?? ""));
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    for (const [k, n] of Object.entries(v)) {
      if (!/^[a-z0-9_]{2,40}$/.test(k) || typeof n !== "number" || !Number.isInteger(n)) return null;
    }
    return v as Record<string, number>;
  } catch {
    return null;
  }
}

export async function submitEntry(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireMonitor();
  const present = Number(fd.get("present"));
  const values = parseValues(fd.get("values"));
  if (!Number.isInteger(present) || present < 1) return { error: "Enter how many students are present." };
  if (!values) return { error: "Please answer every question." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_daily_entry", { p_present: present, p_values: values });
  if (error) return { error: errorMessage(error) };
  revalidatePath("/monitor", "layout");   // header leaves too
  return {
    ok: true,
    message: data?.baseline ? "Saved. (Measuring week: no points yet.)" : `Saved! Your class earned ${pts(data?.points)} points.`,
  };
}

export async function submitAudit(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireMonitor();
  const values = parseValues(fd.get("values"));
  if (!values) return { error: "Please answer every question." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_peer_audit", { p_values: values });
  if (error) return { error: errorMessage(error) };
  revalidatePath("/monitor", "layout");   // header leaves too
  return { ok: true, message: `Thanks! ${data?.target} has been checked.` };
}
