"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { monitorEmail } from "@/lib/supabase/admin";
import type { ActionState } from "@/lib/session";
import { safeNext } from "@/lib/next-path";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function loginMonitor(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const classId = String(fd.get("class_id") ?? "");
  const pin = String(fd.get("pin") ?? "").trim();
  if (!UUID.test(classId)) return { error: "Pick your class." };
  if (!/^\d{6}$/.test(pin)) return { error: "The PIN is 6 digits." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: monitorEmail(classId), password: pin });
  if (error) return { error: "Wrong class or PIN. If you've forgotten it, ask your teacher to reset it." };

  const { data: me } = await supabase.rpc("whoami");
  if (!me || me.role !== "monitor") {
    await supabase.auth.signOut();
    return { error: "This login isn't set up for EcoPoints. Ask your teacher." };
  }
  redirect(safeNext(fd.get("next")) ?? "/monitor");
}

export async function loginTeacher(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Wrong email or password." };

  const { data: me } = await supabase.rpc("whoami");
  if (!me || me.role !== "teacher") {
    await supabase.auth.signOut();
    return { error: "This account isn't a teacher account in EcoPoints." };
  }
  redirect("/teacher");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
