import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Me = {
  user_id: string;
  role: "teacher" | "monitor";
  display_name: string;
  school_id: string;
  school_name: string;
  school_slug: string;
  timezone: string;
  today: string;
  points_start_date: string | null;
  baseline: boolean;
  class_id: string | null;
  class_name: string | null;
};

export const getMe = cache(async (): Promise<Me | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.rpc("whoami");
  if (error || !data) return null;
  return data as Me;
});

export async function requireTeacher(): Promise<Me> {
  const me = await getMe();
  if (!me) redirect("/login?as=teacher");
  if (me.role !== "teacher") redirect("/monitor");
  return me;
}

export async function requireMonitor(): Promise<Me> {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.role !== "monitor") redirect("/teacher");
  return me;
}

export type ActionState = { ok?: boolean; error?: string; message?: string } | null;
