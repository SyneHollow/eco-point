import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/config";

/**
 * Secret-key client. Bypasses RLS. Only use AFTER requireTeacher() has passed,
 * and only for account management (creating logins, setting PINs).
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function monitorEmail(classId: string) {
  const domain = process.env.MONITOR_EMAIL_DOMAIN ?? "nexayra.com";
  return `ecopoints-m-${classId}@${domain}`;
}
